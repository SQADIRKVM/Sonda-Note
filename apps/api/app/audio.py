"""Audio conversion — pipeline layer 04. Server-side only.

Never convert in the browser: it keeps the extension lightweight and the tab
responsive while recording. WhisperX requires 16 kHz mono WAV.
"""
from __future__ import annotations

import asyncio
import logging
import shutil
from pathlib import Path

from .config import settings

logger = logging.getLogger(__name__)


class AudioError(RuntimeError):
    pass


def ffmpeg_available() -> bool:
    return shutil.which(settings.ffmpeg_path) is not None


async def concat_webm_chunks(chunk_paths: list[Path], output_path: Path) -> Path:
    """Join sequential WebM chunks into one file.

    MediaRecorder chunks after the first are not independently valid WebM files —
    only the first carries the header. So we concatenate the raw byte stream and
    let ffmpeg's demuxer resync, rather than using the concat demuxer (which
    would reject the headerless chunks).
    """
    if not chunk_paths:
        raise AudioError("No audio chunks to concatenate")

    with output_path.open("wb") as out:
        for path in chunk_paths:
            with path.open("rb") as src:
                shutil.copyfileobj(src, out)

    return output_path


async def to_wav_16k_mono(input_path: Path, output_path: Path) -> Path:
    """Convert any input container to 16 kHz mono WAV for WhisperX."""
    if not ffmpeg_available():
        raise AudioError(
            f"ffmpeg not found at '{settings.ffmpeg_path}'. "
            "Install it (brew install ffmpeg / apt install ffmpeg) or set FFMPEG_PATH."
        )

    cmd = [
        settings.ffmpeg_path,
        "-hide_banner",
        "-loglevel", "error",
        # Tolerate the resync artifacts from raw chunk concatenation.
        "-fflags", "+discardcorrupt+genpts",
        "-i", str(input_path),
        "-vn",
        "-ar", str(settings.target_sample_rate),
        "-ac", str(settings.target_channels),
        "-f", "wav",
        "-y",
        str(output_path),
    ]

    logger.info("ffmpeg: %s → %s", input_path.name, output_path.name)
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await process.communicate()

    if process.returncode != 0:
        raise AudioError(f"ffmpeg failed (exit {process.returncode}): {stderr.decode()[:500]}")
    if not output_path.exists() or output_path.stat().st_size == 0:
        raise AudioError("ffmpeg produced no output — the recording may be empty")

    return output_path


async def probe_duration(path: Path) -> float:
    """Duration in seconds via ffprobe. Returns 0.0 if unavailable."""
    ffprobe = settings.ffmpeg_path.replace("ffmpeg", "ffprobe")
    if not shutil.which(ffprobe):
        return 0.0

    process = await asyncio.create_subprocess_exec(
        ffprobe,
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await process.communicate()

    try:
        return float(stdout.decode().strip())
    except (ValueError, AttributeError):
        return 0.0
