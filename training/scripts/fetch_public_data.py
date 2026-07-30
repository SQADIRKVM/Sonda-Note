#!/usr/bin/env python
"""Download a public Malayalam speech corpus and write train/eval manifests.

Why this exists: until your own users have corrected enough recordings, you have
no data to train on. This pulls a real, permissively-licensed corpus so the whole
pipeline can be exercised end to end today.

What it does NOT do: produce a model worth shipping. These corpora are read
speech (news, TTS prompts) and monolingual. They teach Malayalam phonetics and
script, not meetings and not code-switching. Your own corrected recordings remain
the asset that matters.

    python fetch_public_data.py --dataset common_voice --hours 2
    python fetch_public_data.py --dataset imasc --hours 10
    python fetch_public_data.py --list
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# HuggingFace dataset ids, with the licence that governs each. Share-alike is
# flagged because mixing CC-BY-SA into a commercial training set is a licensing
# decision, not a default.
DATASETS = {
    "common_voice": {
        "hf_id": "mozilla-foundation/common_voice_17_0",
        "config": "ml",
        "split": "train",
        "audio_key": "audio",
        "text_key": "sentence",
        "licence": "CC0 (permissive)",
        "hours": 2.9,
        "note": "Only ~2.9 validated hours of Malayalam. Smallest, fastest to try.",
        "gated": False,
    },
    "imasc": {
        "hf_id": "thennal/IMaSC",
        "config": None,
        "split": "train",
        "audio_key": "audio",
        "text_key": "text",
        "licence": "CC-BY-SA-4.0 (SHARE-ALIKE — copyleft)",
        "hours": 50.0,
        "note": "50h, 8 speakers. Largest easy option, but share-alike.",
        "gated": False,
    },
    "openslr63": {
        "hf_id": "openslr",
        "config": "SLR63",
        "split": "train",
        "audio_key": "audio",
        "text_key": "sentence",
        "licence": "CC-BY-SA-4.0 (SHARE-ALIKE)",
        "hours": 3.0,
        "note": "~3h, 24 speakers. Commonly miscited as a training set; it isn't.",
        "gated": False,
    },
    "indicvoices": {
        "hf_id": "ai4bharat/IndicVoices",
        "config": "malayalam",
        "split": "train",
        "audio_key": "audio",
        "text_key": "text",
        "licence": "CC-BY-4.0 (permissive)",
        "hours": 60.0,
        "note": "~60h transcribed Malayalam. Prompts encouraged code-mixing but it is UNLABELLED — the best source to mine for Manglish.",
        "gated": True,
    },
}


def show_list() -> None:
    print("Public Malayalam speech corpora\n")
    for key, meta in DATASETS.items():
        gate = "  [needs HF login]" if meta["gated"] else ""
        print(f"  {key:<14} {meta['hours']:>5.1f}h  {meta['licence']}{gate}")
        print(f"  {'':<14} {meta['note']}\n")
    print("Reality check: none of these are meeting speech, and none are")
    print("code-mixed. They teach Malayalam, not your product's domain.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dataset", choices=list(DATASETS), default="common_voice")
    parser.add_argument("--hours", type=float, default=2.0, help="cap on audio to download")
    parser.add_argument("--out", default="../data/manifests", help="where manifests are written")
    parser.add_argument(
        "--audio-dir",
        help="where the WAV files go. Defaults next to --out, but on Colab you "
        "should point this at LOCAL disk (/content/audio) even when manifests "
        "live on Drive — thousands of small files over the Drive FUSE mount are "
        "slow to write and far slower to read on every training epoch.",
    )
    parser.add_argument("--eval-fraction", type=float, default=0.1)
    parser.add_argument("--list", action="store_true", help="show available corpora and exit")
    args = parser.parse_args()

    if args.list:
        show_list()
        return 0

    meta = DATASETS[args.dataset]
    print(f"dataset : {meta['hf_id']}  ({meta['licence']})")
    print(f"note    : {meta['note']}\n")

    if "SHARE-ALIKE" in meta["licence"]:
        print("WARNING: this corpus is copyleft. Training a commercial model on it")
        print("         may oblige you to share alike. Decide deliberately.\n")

    try:
        from datasets import Audio, load_dataset
    except ImportError:
        print("error: pip install datasets soundfile librosa")
        return 1

    try:
        ds = load_dataset(
            meta["hf_id"],
            meta["config"],
            split=meta["split"],
            streaming=True,   # stream so we never download more than --hours
            trust_remote_code=True,
        )
    except Exception as exc:
        print(f"error: could not load {meta['hf_id']}: {exc}")
        if meta["gated"]:
            print("\nThis dataset is gated. Accept its terms on the HuggingFace page,")
            print("then authenticate:  huggingface-cli login")
        return 1

    # Verify the column names before downloading anything. HF datasets rename
    # columns between versions, and discovering a wrong text_key after streaming
    # gigabytes is a miserable way to find out.
    try:
        first = next(iter(ds))
    except Exception as exc:
        print(f"error: could not read the first record: {exc}")
        return 1

    columns = list(first.keys())
    if meta["audio_key"] not in columns:
        candidates = [c for c in columns if "audio" in c.lower() or "path" in c.lower()]
        print(f"error: no '{meta['audio_key']}' column. Available: {columns}")
        if candidates:
            print(f"       try one of: {candidates}")
        return 1

    if meta["text_key"] not in columns:
        # Fall back to the usual transcript column names rather than failing.
        for alternative in ("text", "sentence", "transcript", "transcription", "normalized_text"):
            if alternative in columns:
                print(f"note: '{meta['text_key']}' not found; using '{alternative}' instead")
                meta = {**meta, "text_key": alternative}
                break
        else:
            print(f"error: no transcript column found. Available: {columns}")
            return 1

    print(f"columns : {columns}")
    print(f"using   : audio='{meta['audio_key']}'  text='{meta['text_key']}'\n")

    ds = ds.cast_column(meta["audio_key"], Audio(sampling_rate=16_000))

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.audio_dir:
        audio_dir = Path(args.audio_dir) / args.dataset
    elif str(out_dir).startswith("/content/drive"):
        # Manifests on Drive but no --audio-dir given: default the audio to local
        # disk anyway. Writing thousands of small WAVs to the FUSE mount would
        # dominate both this download and every later training epoch.
        audio_dir = Path("/content/audio") / args.dataset
        print(f"note: manifests -> Drive, audio -> {audio_dir} (local, much faster)")
        print("      /content is wiped on disconnect; rerun this script to refetch.\n")
    else:
        audio_dir = out_dir.parent / "audio" / args.dataset

    audio_dir.mkdir(parents=True, exist_ok=True)

    try:
        import soundfile as sf
    except ImportError:
        print("error: pip install soundfile")
        return 1

    budget = args.hours * 3600
    entries: list[dict] = []
    seconds = 0.0

    print(f"downloading up to {args.hours}h…")
    for index, row in enumerate(ds):
        audio = row[meta["audio_key"]]
        text = (row.get(meta["text_key"]) or "").strip()
        if not text:
            continue

        duration = len(audio["array"]) / audio["sampling_rate"]
        # Whisper's window is 30s; anything shorter than 0.5s is usually noise.
        if not (0.5 <= duration <= 30.0):
            continue

        path = audio_dir / f"{index:06d}.wav"
        sf.write(path, audio["array"], audio["sampling_rate"])
        entries.append({"audio": str(path.resolve()), "text": text, "duration": round(duration, 3)})

        seconds += duration
        if len(entries) % 100 == 0:
            print(f"  {len(entries)} clips  {seconds / 3600:.2f}h", flush=True)
        if seconds >= budget:
            break

    if not entries:
        print("error: no usable clips found")
        return 1

    # Split by position rather than at random: streaming order is already
    # arbitrary, and a deterministic split keeps eval comparable across runs.
    split_at = max(1, int(len(entries) * (1 - args.eval_fraction)))
    train, evalset = entries[:split_at], entries[split_at:]

    for name, rows in (("train", train), ("eval", evalset)):
        path = out_dir / f"{name}.jsonl"
        with path.open("w", encoding="utf-8") as fh:
            for row in rows:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
        hours = sum(r["duration"] for r in rows) / 3600
        print(f"  {path}  {len(rows)} clips  {hours:.2f}h")

    print(f"\naudio in {audio_dir}")
    print("\nNOTE: this is READ speech, monolingual Malayalam. Use it to validate")
    print("the pipeline and get a baseline — not as a substitute for your own")
    print("meeting recordings, which are what actually make the product better.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
