#!/usr/bin/env python
"""Score an ASR model against an eval manifest.

Reports WER, CER, a per-script breakdown, and entity recall. Read CER first for
Malayalam — WER over-penalises agglutinative languages, where one wrong morpheme
fails an entire long word.

Two modes:

  --model PATH     run the model over the audio, then score  (needs a GPU + deps)
  --compare-raw    score the manifest's stored raw_text against its corrected
                   text, with no model at all. This measures what the workspace
                   vocabulary cleaner contributes, and runs on a laptop.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "eval"))

from metrics import evaluate  # noqa: E402


def load(path: Path) -> list[dict]:
    entries = []
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    return entries


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--model", help="model or LoRA adapter to run")
    parser.add_argument(
        "--compare-raw",
        action="store_true",
        help="score stored raw_text vs corrected text (no model, no GPU)",
    )
    parser.add_argument("--vocabulary", help="JSON list of terms for entity recall")
    parser.add_argument("--limit", type=int, help="only score the first N utterances")
    args = parser.parse_args()

    manifest = Path(args.manifest)
    if not manifest.exists():
        print(f"error: no manifest at {manifest}")
        return 1

    entries = load(manifest)
    if args.limit:
        entries = entries[: args.limit]
    if not entries:
        print("error: manifest is empty")
        return 1

    vocabulary: list[str] = []
    if args.vocabulary:
        vocabulary = json.loads(Path(args.vocabulary).read_text())

    verified = sum(1 for e in entries if e.get("verified"))
    if verified < len(entries):
        print(
            f"warning: {len(entries) - verified} of {len(entries)} utterances are "
            "NOT human-verified — treat these numbers as indicative only\n"
        )

    if args.compare_raw:
        pairs = [
            (e["text"], e["raw_text"])
            for e in entries
            if e.get("raw_text") and e["raw_text"] != e["text"]
        ]
        if not pairs:
            print("No segments where raw_text differs from the corrected text.")
            print("Nothing to compare — the cleaner changed nothing on this set.")
            return 0

        print(f"CLEANER CONTRIBUTION  ({len(pairs)} segments the cleaner altered)")
        print("reference = corrected text, hypothesis = raw ASR output\n")
        print(evaluate(pairs, vocabulary).summary())
        print("\nThis is the error the vocabulary layer REMOVES. Entity recall here")
        print("is raw ASR's hit rate on your product terms before cleaning.")
        return 0

    if not args.model:
        print("error: pass --model to score a model, or --compare-raw for the cleaner")
        return 1

    try:
        import torch
        from transformers import pipeline
    except ImportError as exc:
        print(f"error: missing {exc.name} — pip install -r training/requirements.txt")
        return 1

    device = 0 if torch.cuda.is_available() else -1
    if device == -1:
        print("warning: no GPU — transcription will be slow\n")

    asr = pipeline(
        "automatic-speech-recognition",
        model=args.model,
        device=device,
        generate_kwargs={"language": "ml", "task": "transcribe"},
    )

    pairs = []
    for index, entry in enumerate(entries, 1):
        audio = entry.get("audio")
        if not audio or not Path(audio).exists():
            continue
        result = asr(audio)
        pairs.append((entry["text"], result["text"]))
        if index % 25 == 0:
            print(f"  {index}/{len(entries)}…", flush=True)

    if not pairs:
        print("error: no audio files from the manifest were readable")
        return 1

    print(f"\nMODEL: {args.model}\n")
    print(evaluate(pairs, vocabulary).summary())
    return 0


if __name__ == "__main__":
    sys.exit(main())
