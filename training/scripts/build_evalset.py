#!/usr/bin/env python
"""Build a Manglish evaluation set from your own Sonda Note recordings.

This is the highest-value script here, and the reason is uncomfortable: there is
no public Malayalam-English code-switched ASR benchmark. The only public
code-mixed speech on earth is MLENSPEECH (3h20m, 5 speakers, finance lectures).
You cannot borrow an eval set, and without one you cannot tell whether any model
change helped or hurt.

So the eval set becomes a proprietary asset. It is also the cheapest thing here:
~20 hours of your own Kerala meeting audio, corrected once by the people who
were in the meeting, is worth more than any amount of scraped read speech.

The workflow this supports:

  1. Record meetings through Sonda Note as normal.
  2. Users correct transcripts in the dashboard — which they already do, because
     corrections feed the workspace vocabulary.
  3. This script exports (audio, human-corrected text) pairs as an eval manifest.
  4. Every model change is scored against it with eval/metrics.py.

Corrected segments are the signal. A segment nobody edited is not evidence the
ASR was right — it may just be unread. Only `edited_at IS NOT NULL` rows are
treated as verified ground truth by default.

    python build_evalset.py --out ../data/manifests/sondanote_eval.jsonl
    python build_evalset.py --include-unedited --min-duration 1.0
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Reuse the running product's database rather than duplicating schema knowledge.
API_ROOT = Path(__file__).resolve().parents[2] / "apps" / "api"
sys.path.insert(0, str(API_ROOT))

_MALAYALAM = re.compile(r"[ഀ-ൿ]")
_LATIN = re.compile(r"[A-Za-z]")


def code_mix_score(text: str) -> float:
    """Fraction of tokens that are Latin, among tokens carrying either script.

    Used to rank and report how genuinely code-mixed the set is. A "Manglish"
    eval set that is 98% pure Malayalam does not test what you think it tests.
    """
    tokens = [t for t in text.split() if _MALAYALAM.search(t) or _LATIN.search(t)]
    if not tokens:
        return 0.0
    latin = sum(1 for t in tokens if _LATIN.search(t) and not _MALAYALAM.search(t))
    intra = sum(1 for t in tokens if _LATIN.search(t) and _MALAYALAM.search(t))
    # Intra-word switches count double: they are the hardest case and the one
    # worth over-sampling into an eval set.
    return (latin + 2 * intra) / len(tokens)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default="../data/manifests/sondanote_eval.jsonl")
    parser.add_argument("--min-duration", type=float, default=0.8)
    parser.add_argument("--max-duration", type=float, default=30.0)
    parser.add_argument(
        "--include-unedited",
        action="store_true",
        help="also export segments nobody corrected (NOT verified ground truth)",
    )
    parser.add_argument("--workspace", help="limit to one workspace id")
    args = parser.parse_args()

    try:
        from app import local_store as ls
        from app.config import settings
    except ImportError as exc:
        print(f"error: cannot import the Sonda Note backend ({exc})")
        print(f"       expected it at {API_ROOT}")
        return 1

    # The backend's default paths are relative to apps/api, so running from
    # anywhere else would silently open (and create) an empty database instead of
    # the real one. Resolve both against the API root before connecting.
    if not Path(settings.local_db_path).is_absolute():
        settings.local_db_path = str((API_ROOT / settings.local_db_path).resolve())
    if not Path(settings.local_storage_dir).is_absolute():
        settings.local_storage_dir = str((API_ROOT / settings.local_storage_dir).resolve())

    if not Path(settings.local_db_path).exists():
        print(f"error: no Sonda Note database at {settings.local_db_path}")
        print("       start the API once to create it, then record a meeting")
        return 1

    ls.get_conn()

    # Only meetings that produced a transcript and still have their audio.
    query = """
        SELECT s.id, s.meeting_id, s.workspace_id, s.seq, s.speaker,
               s.start_secs, s.end_secs, s.text, s.raw_text, s.edited_at,
               m.title, m.language
        FROM transcript_segments s
        JOIN meetings m ON m.id = s.meeting_id
        WHERE m.status = 'ready'
    """
    params: list = []
    if not args.include_unedited:
        query += " AND s.edited_at IS NOT NULL"
    if args.workspace:
        query += " AND s.workspace_id = ?"
        params.append(args.workspace)
    query += " ORDER BY s.meeting_id, s.seq"

    rows = ls.query(query, tuple(params))
    if not rows:
        print("No usable segments found.")
        print()
        if not args.include_unedited:
            print("Only human-CORRECTED segments are exported, because an untouched")
            print("segment is not evidence the ASR was right. Correct some transcripts")
            print("in the dashboard first, or pass --include-unedited to export anyway")
            print("(and treat the result as unverified).")
        return 1

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    kept = skipped_duration = skipped_empty = 0
    total_seconds = 0.0
    mix_scores: list[float] = []
    audio_root = Path(ls.storage_root())

    with out_path.open("w", encoding="utf-8") as fh:
        for row in rows:
            text = (row["text"] or "").strip()
            if not text:
                skipped_empty += 1
                continue

            duration = float(row["end_secs"]) - float(row["start_secs"])
            if not (args.min_duration <= duration <= args.max_duration):
                skipped_duration += 1
                continue

            # Audio is stored per meeting, not per segment. Record the offsets so
            # a later slicing step can cut exact clips.
            meeting_audio = audio_root / row["workspace_id"] / row["meeting_id"]

            entry = {
                "audio": str(meeting_audio),
                "offset": round(float(row["start_secs"]), 3),
                "duration": round(duration, 3),
                "text": text,
                # raw_text is what ASR+cleaner produced before the human fixed it.
                # Keeping it lets you measure the cleaner's contribution separately.
                "raw_text": (row["raw_text"] or "").strip(),
                "speaker": row["speaker"],
                "language": row["language"] or "ml",
                "verified": row["edited_at"] is not None,
                "meeting": row["title"],
                "code_mix": round(code_mix_score(text), 3),
            }
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")

            kept += 1
            total_seconds += duration
            mix_scores.append(entry["code_mix"])

    verified = sum(1 for r in rows if r["edited_at"])
    avg_mix = sum(mix_scores) / len(mix_scores) if mix_scores else 0.0

    print(f"wrote {out_path}")
    print(f"  utterances      {kept}")
    print(f"  audio           {total_seconds / 3600:.2f} h")
    print(f"  human-verified  {verified}")
    print(f"  avg code-mix    {avg_mix:.1%}")
    if skipped_duration:
        print(f"  skipped         {skipped_duration} outside duration bounds")
    if skipped_empty:
        print(f"  skipped         {skipped_empty} empty")

    print()
    hours = total_seconds / 3600
    if hours < 0.5:
        print("This is far too small to be a benchmark. Target ~2h minimum for a")
        print("usable signal, ~20h to make it genuinely valuable. Keep recording;")
        print("this set is the asset no competitor has.")
    elif hours < 5:
        print("Usable for smoke-testing model changes, still noisy for small deltas.")
        print("Keep growing it toward ~20h.")
    else:
        print("Solid eval set. Score models with:")
        print(f"  python scripts/evaluate.py --manifest {out_path}")

    if avg_mix < 0.15:
        print()
        print("NOTE: low code-mix ratio — this set is mostly monolingual, so it will")
        print("not tell you much about Manglish specifically. Prioritise meetings")
        print("with heavy English-Malayalam switching.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
