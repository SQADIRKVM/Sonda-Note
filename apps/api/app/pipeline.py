"""Pipeline orchestration: chunks → WAV → ASR → cleaner → transcript → intelligence.

Post-processing only (Month 1–2). No streaming, no live captions — the recording
finishes, then this runs. That choice is what keeps the MVP simple enough to ship.

Diarization (layer 06, NeMo MSDD) is Month 3. Until then every segment is
attributed to a single speaker label; `_assign_speakers` marks where the merge
will slot in.
"""
from __future__ import annotations

import logging
import tempfile
from pathlib import Path

from . import db
from .asr import get_asr_provider
from .audio import concat_webm_chunks, probe_duration, to_wav_16k_mono
from .cleaner import Term, build_cleaner
from .config import settings
from .llm import get_llm_provider
from .templates import get_template

logger = logging.getLogger(__name__)

# Anything shorter than this is a mis-started recording, not a meeting.
MIN_MEETING_SECONDS = 2.0


class PipelineError(RuntimeError):
    pass


async def process_meeting(meeting_id: str, workspace_id: str, industry: str = "tech") -> dict:
    """Run the full transcription pipeline for one recorded meeting.

    Sets meeting status as it advances so the dashboard can poll. Any failure
    marks the meeting `failed` with the reason and re-raises — the audio chunks
    stay in storage, so a retry needs no re-recording.
    """
    logger.info("Pipeline start: meeting=%s workspace=%s", meeting_id, workspace_id)
    db.set_meeting_status(meeting_id, workspace_id, "processing")

    try:
        chunks = db.list_chunks(meeting_id, workspace_id)
        if not chunks:
            raise PipelineError("No audio was uploaded for this meeting")

        with tempfile.TemporaryDirectory(prefix="sondanote-") as tmpdir:
            tmp = Path(tmpdir)

            # ── layers 01-03 already happened in the extension; fetch the result ──
            chunk_paths = []
            for chunk in chunks:
                payload = db.download_chunk(chunk["storage_path"])
                path = tmp / f"chunk-{chunk['seq']:05d}.webm"
                path.write_bytes(payload)
                chunk_paths.append(path)

            merged = await concat_webm_chunks(chunk_paths, tmp / "merged.webm")

            # ── layer 04: convert to 16kHz mono WAV ──
            wav = await to_wav_16k_mono(merged, tmp / "audio.wav")
            duration = await probe_duration(wav)

            # A recording this short means the capture was stopped almost
            # immediately or produced no real audio. Failing loudly here is much
            # better than transcribing near-silence and presenting the result as
            # a real meeting.
            if duration < MIN_MEETING_SECONDS:
                raise PipelineError(
                    f"Recording is only {duration:.1f}s of audio — too short to transcribe. "
                    "Check that the meeting tab had sound and that recording ran for a while "
                    "before you stopped it."
                )

            if duration > settings.max_meeting_seconds:
                raise PipelineError(
                    f"Recording is {duration / 3600:.1f}h, over the "
                    f"{settings.max_meeting_seconds / 3600:.0f}h limit"
                )

            # ── layer 05: ASR (WhisperX — one pass, never Whisper twice) ──
            asr = get_asr_provider()
            result = await asr.transcribe(wav, language=settings.asr_language or None)

            if not result.segments:
                raise PipelineError("No speech detected in this recording")

        # ── layer 06: diarization placeholder (Month 3) ──
        segments = _assign_speakers(
            [
                {
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text,
                    "language": result.language,
                }
                for seg in result.segments
            ]
        )

        # ── layer 07: transcript cleaner (the moat) ──
        vocabulary = [
            Term(wrong=row["wrong"], right=row["right_term"], source=row.get("source", "manual"))
            for row in db.list_vocabulary(workspace_id)
        ]
        cleaner = build_cleaner(vocabulary, industry=industry)
        cleaned, hits = cleaner.clean_segments(segments)

        logger.info(
            "Cleaner: %d terms active, %d replacements across %d segments",
            cleaner.term_count,
            sum(hits.values()),
            len(cleaned),
        )
        db.increment_vocabulary_hits(workspace_id, hits)

        # ── persist ──
        db.replace_transcript(meeting_id, workspace_id, cleaned)
        speaker_count = len({seg["speaker"] for seg in cleaned})
        db.update_meeting(
            meeting_id,
            workspace_id,
            status="ready",
            error_message=None,
            # Prefer ffprobe's measurement of the actual audio. result.duration
            # is only a fallback — with ASR_PROVIDER=mock it describes canned
            # sample text, not the recording, and must never be shown as if it
            # were the real length.
            duration_secs=int(duration) if duration > 0 else None,
            language=result.language,
            speaker_count=speaker_count,
        )

        logger.info("Pipeline done: meeting=%s segments=%d", meeting_id, len(cleaned))
        return {
            "meeting_id": meeting_id,
            "segments": len(cleaned),
            "duration_secs": int(duration) if duration > 0 else None,
            "language": result.language,
            "speaker_count": speaker_count,
            "vocabulary_replacements": sum(hits.values()),
        }

    except Exception as exc:
        logger.exception("Pipeline failed: meeting=%s", meeting_id)
        db.set_meeting_status(meeting_id, workspace_id, "failed", error_message=str(exc)[:500])
        raise


def _assign_speakers(segments: list[dict]) -> list[dict]:
    """Attach speaker labels.

    Month 1–2: a single label, because tab audio and mic audio are merged into one
    stream before upload and nothing can separate them yet.

    Month 3 replaces this with NeMo MSDD (Apache 2.0 — NOT Pyannote, whose
    non-commercial licence would block monetisation): run diarization on the same
    WAV, then assign each segment the speaker whose turn overlaps its word
    timestamps most.
    """
    for seg in segments:
        seg.setdefault("speaker", "Speaker 1")
    return segments


async def generate_intelligence(
    meeting_id: str,
    workspace_id: str,
    template_id: str,
    workspace_name: str = "",
) -> dict:
    """Run layer 09: summary, action items, insights for one template."""
    template = get_template(template_id)
    segments = db.get_transcript(meeting_id, workspace_id)
    if not segments:
        raise PipelineError("No transcript yet — process the recording first")

    meeting = db.get_meeting(meeting_id, workspace_id)
    transcript_text = format_transcript(segments)

    if len(transcript_text) > settings.llm_max_transcript_chars:
        logger.warning(
            "Transcript is %d chars; truncating to %d for the LLM call",
            len(transcript_text),
            settings.llm_max_transcript_chars,
        )
        transcript_text = transcript_text[: settings.llm_max_transcript_chars]

    vocabulary_hint = [row["right_term"] for row in db.list_vocabulary(workspace_id)]

    llm = get_llm_provider()
    summary = await llm.summarise(
        template,
        transcript_text,
        meeting_title=(meeting or {}).get("title", ""),
        workspace_name=workspace_name,
        vocabulary_hint=vocabulary_hint,
    )

    db.save_summary(
        meeting_id,
        workspace_id,
        template.id,
        summary.overview,
        summary.sections,
        summary.model,
    )
    db.replace_action_items(
        meeting_id,
        workspace_id,
        [
            {"text": item.text, "owner": item.owner, "due_hint": item.due_hint}
            for item in summary.action_items
        ],
    )
    db.replace_insights(
        meeting_id,
        workspace_id,
        [{"kind": insight.kind, "text": insight.text} for insight in summary.insights],
    )

    return {
        "template": template.id,
        "overview": summary.overview,
        "sections": summary.sections,
        "action_items": [
            {"text": i.text, "owner": i.owner, "due_hint": i.due_hint}
            for i in summary.action_items
        ],
        "insights": [{"kind": i.kind, "text": i.text} for i in summary.insights],
        "model": summary.model,
    }


def format_transcript(segments: list[dict], include_timestamps: bool = True) -> str:
    """Speaker-attributed plain text for the LLM and for TXT export.

    Consecutive turns by the same speaker are merged so the model sees coherent
    paragraphs instead of 30-second fragments.
    """
    lines: list[str] = []
    current_speaker: str | None = None
    buffer: list[str] = []
    buffer_start = 0.0

    def flush() -> None:
        if not buffer or current_speaker is None:
            return
        prefix = f"[{_timestamp(buffer_start)}] " if include_timestamps else ""
        lines.append(f"{prefix}{current_speaker}: {' '.join(buffer)}")

    for seg in segments:
        speaker = seg.get("speaker") or "Speaker 1"
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        if speaker != current_speaker:
            flush()
            current_speaker = speaker
            buffer = [text]
            buffer_start = float(seg.get("start_secs") or seg.get("start") or 0.0)
        else:
            buffer.append(text)

    flush()
    return "\n".join(lines)


def _timestamp(seconds: float) -> str:
    total = int(seconds)
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"
