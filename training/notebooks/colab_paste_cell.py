"""Sonda Note Malayalam ASR fine-tune — single-cell Colab bootstrap.

USE THIS IF THE .ipynb IS AWKWARD TO GET INTO COLAB.

Copy the ENTIRE contents of this file into ONE Colab code cell and run it.
It is ordinary Python, so pasting it cannot produce the `NameError: name 'true'
is not defined` you get from pasting raw notebook JSON into a cell.

Before running: Runtime -> Change runtime type -> T4 GPU.

What it does, in order:
  1. verifies the GPU and picks fp16 vs bf16 correctly for that card
  2. mounts Drive so checkpoints survive a disconnect
  3. installs pinned dependencies
  4. fetches the training code
  5. checks your manifests and estimates the run time
Then it prints the exact commands for baseline -> train -> compare.
"""

# ─────────────────────────────────────────────────────────
# 0. CONFIGURE — edit these three, then run the whole cell.
# ─────────────────────────────────────────────────────────

# Where the training/ folder lives. Either a git repo, or a path in your Drive.
GIT_REPO = ""  # e.g. "https://github.com/YOUR_ORG/meet-ai.git"
DRIVE_TRAINING_DIR = "sondanote-asr/training"  # relative to MyDrive, if not using git

# Manifests, relative to MyDrive.
TRAIN_MANIFEST = "sondanote-asr/manifests/train.jsonl"
EVAL_MANIFEST = "sondanote-asr/manifests/sondanote_eval.jsonl"


# ─────────────────────────────────────────────────────────
# 1. GPU
# ─────────────────────────────────────────────────────────

import subprocess
import sys

print("=" * 62)
print("1. GPU")
print("=" * 62)

if subprocess.run(["which", "nvidia-smi"], capture_output=True).returncode != 0:
    raise SystemExit("No GPU runtime. Runtime -> Change runtime type -> T4 GPU, then rerun.")

import torch

if not torch.cuda.is_available():
    raise SystemExit("CUDA not available. Runtime -> Change runtime type -> T4 GPU, then rerun.")

GPU_NAME = torch.cuda.get_device_name(0)
VRAM_GB = torch.cuda.get_device_properties(0).total_memory / 1024**3

# Check compute capability directly, NOT torch.cuda.is_bf16_supported().
# That helper takes `including_emulation=True` by default and so returns True on
# a T4, which has no bf16 hardware at all — only a slow emulated path. Trusting
# it picks the A100 config on a T4 and OOMs.
#   sm_75 Turing (T4)  -> no
#   sm_80 Ampere (A100) -> yes
#   sm_89 Ada    (L4)   -> yes
MAJOR, MINOR = torch.cuda.get_device_capability(0)
HAS_BF16 = MAJOR >= 8

print(f"  {GPU_NAME}  {VRAM_GB:.0f}GB  compute {MAJOR}.{MINOR}  bf16(hardware)={HAS_BF16}")
if not HAS_BF16:
    print("  -> pre-Ampere card: using fp16. (torch.cuda.is_bf16_supported() lies")
    print("     here — it counts emulation, which is slow and OOM-prone.)")
if VRAM_GB < 20:
    print("  -> 16GB: using configs/whisper_ml_lora_colab.yaml (batch 2, accum 8).")


# ─────────────────────────────────────────────────────────
# 2. DRIVE
# ─────────────────────────────────────────────────────────

print("\n" + "=" * 62)
print("2. Drive")
print("=" * 62)

import pathlib

DRIVE_OK = False
try:
    from google.colab import drive

    drive.mount("/content/drive")
    DRIVE_OK = pathlib.Path("/content/drive/MyDrive").exists()
except Exception as exc:
    # "credential propagation was unsuccessful" means the auth popup was blocked
    # or dismissed — not a fault in this script. Degrade instead of dying, so a
    # short run can still proceed without Drive.
    print(f"\n  Drive mount failed: {type(exc).__name__}: {exc}")
    print("\n  Usually one of:")
    print("    · the popup was blocked — allow popups for colab.research.google.com")
    print("    · you dismissed the account/permission prompt")
    print("    · third-party cookies are blocked (Brave/Safari strict mode)")
    print("    · a stale session — Runtime -> Disconnect and delete runtime, retry")
    print("\n  Fix: rerun this cell and complete the popup. Or run WITHOUT Drive:")
    print("    files go to /content, which is WIPED when the session ends, so")
    print("    download the adapter before you disconnect.")

if DRIVE_OK:
    MYDRIVE = pathlib.Path("/content/drive/MyDrive")
    print("  Drive mounted — checkpoints will survive a disconnect")
else:
    # Local fallback. Training still works; only persistence is lost.
    MYDRIVE = pathlib.Path("/content")
    print("\n  CONTINUING WITHOUT DRIVE — /content is wiped on disconnect.")
    print("  Save the adapter yourself before the session ends.")

WORK = MYDRIVE / "sondanote-asr"
WORK.mkdir(parents=True, exist_ok=True)
(WORK / "manifests").mkdir(exist_ok=True)
print(f"  working dir: {WORK}")


# ─────────────────────────────────────────────────────────
# 3. DEPENDENCIES
# ─────────────────────────────────────────────────────────

print("\n" + "=" * 62)
print("3. Installing (pinned — Colab's preinstalled transformers breaks PEFT)")
print("=" * 62)

subprocess.run(
    [
        sys.executable, "-m", "pip", "install", "-q",
        "transformers==4.48.0", "datasets==3.2.0", "peft==0.14.0",
        "accelerate==1.2.1", "librosa==0.10.2.post1", "soundfile==0.12.1",
        "evaluate==0.4.3", "pyyaml==6.0.2",
    ],
    check=True,
)
print("  done")


# ─────────────────────────────────────────────────────────
# 4. CODE
# ─────────────────────────────────────────────────────────

print("\n" + "=" * 62)
print("4. Training code")
print("=" * 62)

import shutil

TRAIN_DIR = pathlib.Path("/content/training")
if TRAIN_DIR.exists():
    shutil.rmtree(TRAIN_DIR)

if GIT_REPO:
    subprocess.run(["git", "clone", "-q", GIT_REPO, "/content/repo"], check=True)
    shutil.copytree("/content/repo/training", TRAIN_DIR)
    print(f"  cloned from {GIT_REPO}")
else:
    source = MYDRIVE / DRIVE_TRAINING_DIR
    if not source.exists():
        raise SystemExit(
            f"Training code not found at {source}.\n"
            f"Either upload the training/ folder to MyDrive/{DRIVE_TRAINING_DIR},\n"
            f"or set GIT_REPO at the top of this cell."
        )
    shutil.copytree(source, TRAIN_DIR)
    print(f"  copied from {source}")

sys.path.insert(0, str(TRAIN_DIR / "scripts"))
sys.path.insert(0, str(TRAIN_DIR / "eval"))


# ─────────────────────────────────────────────────────────
# 5. DATA
# ─────────────────────────────────────────────────────────

print("\n" + "=" * 62)
print("5. Data")
print("=" * 62)

import json

train_path = MYDRIVE / TRAIN_MANIFEST
eval_path = MYDRIVE / EVAL_MANIFEST

# build_evalset.py writes sondanote_eval.jsonl; fetch_public_data.py writes
# eval.jsonl. Accept whichever is present so fetching data actually satisfies
# this check instead of silently still reporting "NO DATA YET".
if not eval_path.exists():
    for alternative in ("eval.jsonl", "sondanote_eval.jsonl"):
        candidate = eval_path.parent / alternative
        if candidate.exists():
            eval_path = candidate
            print(f"  using eval manifest: {candidate.name}")
            break


def _load(path: pathlib.Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


train_entries = _load(train_path)
eval_entries = _load(eval_path)

if not train_entries:
    print(f"  MISSING training manifest: {train_path}")
if not eval_entries:
    print(f"  MISSING eval manifest:     {eval_path}")

if train_entries:
    hours = sum(e.get("duration") or 0 for e in train_entries) / 3600
    print(f"  train {len(train_entries):>6} utterances  {hours:>6.2f}h")
    print(f"  eval  {len(eval_entries):>6} utterances")

    # Anchored on a measured run (ivrit.ai: 400h x 2 epochs = 49h on one 4090
    # for an 809M model), scaled for Whisper-medium and a ~3x slower T4.
    t4_hours = (hours * 3) * (49 / 800) * 2 * (1 if HAS_BF16 and VRAM_GB > 20 else 3)
    print(f"\n  estimated time: ~{t4_hours:.1f}h on this GPU for 3 epochs")

    if hours < 5:
        print("\n  NOTE: under 5h of audio. Published curves show gains starting")
        print("  around ~8h and staying noisy below ~50h. Run it to validate the")
        print("  pipeline end to end — do not expect a shippable model.")
    if t4_hours > 11:
        print(f"\n  NOTE: ~{t4_hours:.0f}h exceeds one Colab session (~12h cap).")
        print(f"  Expect ~{int(t4_hours // 11) + 1} reconnects. --auto-resume handles it;")
        print("  just rerun the training command each time.")

    # Drive FUSE reads are slow enough to dominate training time on datasets of
    # many small files. Warn if the audio is still on the mount.
    on_drive = sum(1 for e in train_entries[:50] if str(e.get("audio", "")).startswith("/content/drive"))
    if on_drive > 25:
        print("\n  WARNING: audio is being read from Drive. Copy it to local disk")
        print("  first or I/O will dominate your training time:")
        print("      !cp -r /content/drive/MyDrive/sondanote-asr/audio /content/audio")
        print("  then update the 'audio' paths in your manifest.")


# ─────────────────────────────────────────────────────────
# 6. WRITE THE LIVE CONFIG
# ─────────────────────────────────────────────────────────

if train_entries and eval_entries:
    import yaml

    base_config = TRAIN_DIR / "configs" / (
        "whisper_ml_lora_colab.yaml" if VRAM_GB < 20 else "whisper_ml_lora.yaml"
    )
    config = yaml.safe_load(base_config.read_text())
    config["train_manifest"] = str(train_path)
    config["eval_manifest"] = str(eval_path)
    config["output_dir"] = str(WORK / "whisper-ml-lora")
    # Trust the detected hardware over whatever the file says.
    config["bf16"] = HAS_BF16
    config["fp16"] = not HAS_BF16

    live_config = TRAIN_DIR / "configs" / "colab_live.yaml"
    live_config.write_text(yaml.safe_dump(config, sort_keys=False))

    print("\n" + "=" * 62)
    print("READY")
    print("=" * 62)
    print(f"  config: {live_config}  (from {base_config.name})")
    print("\nRun these in NEW cells, in order:\n")
    print("  # a. sanity-check the plan and cost")
    print("  !cd /content/training && python scripts/finetune.py \\")
    print("       --config configs/colab_live.yaml --dry-run")
    print("\n  # b. BASELINE FIRST — without a before-number, after means nothing")
    print("  !cd /content/training && python scripts/evaluate.py \\")
    print(f"       --manifest {eval_path} --model openai/whisper-medium")
    print("\n  # c. train (rerun this exact command after any disconnect)")
    print("  !cd /content/training && python scripts/finetune.py \\")
    print("       --config configs/colab_live.yaml --auto-resume")
    print("\n  # d. compare — read CER before WER for Malayalam")
    print("  !cd /content/training && python scripts/evaluate.py \\")
    print(f"       --manifest {eval_path} --model {WORK / 'whisper-ml-lora'}")

    if not DRIVE_OK:
        print("\n  " + "!" * 58)
        print("  NO DRIVE: checkpoints go to /content and are LOST on disconnect.")
        print("  --auto-resume cannot save you. Download the adapter as soon as")
        print("  training finishes:")
        print("      from google.colab import files")
        print(f"      import shutil; files.download(shutil.make_archive("
              f"'/content/adapter', 'zip', '{WORK / 'whisper-ml-lora'}'))")
        print("  " + "!" * 58)
else:
    print("\n" + "=" * 62)
    print("NO DATA YET")
    print("=" * 62)
    print(f"  expected: {train_path}")
    print(f"            {eval_path}")
    print("\nTwo ways forward.\n")
    print("A) Try the pipeline now on a PUBLIC Malayalam corpus.")
    print("   Read speech, monolingual — good for validating the whole flow and")
    print("   getting a baseline, not for shipping. Run in a new cell:\n")
    print("     !cd /content/training/scripts && python fetch_public_data.py --list")
    print("\n     !cd /content/training/scripts && \\")
    print("        python fetch_public_data.py --dataset imasc --hours 2 \\")
    print(f"        --out {WORK / 'manifests'} \\")
    print("        --audio-dir /content/audio")
    print("\n   Note --audio-dir: manifests go to Drive (persistent), audio stays")
    print("   on local disk. Thousands of small files over the Drive mount would")
    print("   dominate every training epoch.")
    print("\n   Then rerun this cell.\n")
    print("B) Use YOUR OWN recordings — this is the one that matters.")
    print("   Record meetings in Sonda Note, correct the transcripts in the dashboard,")
    print("   then locally:\n")
    print("     cd training/scripts")
    print("     ../../apps/api/.venv/bin/python build_evalset.py \\")
    print("         --out ../data/manifests/sondanote_eval.jsonl\n")
    print("   Upload the result to MyDrive/sondanote-asr/manifests/.")
    print("\n   Public corpora teach Malayalam. Only your recordings teach")
    print("   MEETINGS and code-switching, which is where the product wins.")
