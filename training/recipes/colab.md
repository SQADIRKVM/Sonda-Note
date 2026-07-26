# Fine-tuning on Google Colab

Free, and genuinely sufficient for a first fine-tune.

## Getting the notebook into Colab

Pick ONE. Both work; the second avoids notebook-upload friction entirely.

### Option A — open the .ipynb

1. [colab.research.google.com](https://colab.research.google.com)
2. **File → Upload notebook**, choose
   [`notebooks/sondanote_finetune_colab.ipynb`](../notebooks/sondanote_finetune_colab.ipynb)
3. **Runtime → Change runtime type → T4 GPU**
4. Run the cells top to bottom

> **Do not open the .ipynb as text and paste its contents into a cell.** The file
> is JSON, and running JSON as Python gives:
> ```
> NameError: name 'true' is not defined
> ```
> That error means the notebook JSON was executed as code, not that anything is
> broken. Upload the file, or use Option B.

### Option B — one paste-able cell

Open [`notebooks/colab_paste_cell.py`](../notebooks/colab_paste_cell.py), copy
**all** of it into a single Colab code cell, and run. It is plain Python, so
pasting it cannot produce the error above.

It checks the GPU, picks fp16/bf16 correctly for that card, mounts Drive,
installs pinned deps, fetches the code, validates your manifests, estimates the
run time, and prints the exact commands to run next.

Edit the three variables at the top first (`GIT_REPO` or `DRIVE_TRAINING_DIR`,
and the two manifest paths).

## Is Colab the right choice?

| Your data | Free T4 | Verdict |
|---|---|---|
| < 10 h | ~10 h, one session | **Colab.** Costs nothing |
| 10–30 h | ~30 h, 3 reconnects | **Colab** if patient, rented if not |
| 30–100 h | 30–110 h, many reconnects | **Rent.** ~$20–55 saves days |
| > 100 h | impractical | **Rent** |

The crossover is roughly **30 hours of audio**. Below it Colab is free and fine;
above it you are spending days of babysitting to save about the price of a meal.

Run `--dry-run` and it prints both estimates.

## What the free tier actually gives you

- **T4, 16GB VRAM** — enough for Whisper-medium LoRA at batch 2
- **No bf16.** The T4 is Turing (sm_75). `whisper_ml_lora_colab.yaml` uses fp16;
  `finetune.py` also auto-corrects this if you point it at the wrong config
- **~12 h session cap**, and it idle-disconnects after ~90 min unattended
- **Local disk is wiped** on disconnect — checkpoint to Drive, always

Colab Pro (~$10/mo) gives L4/A100 with bf16 and longer sessions. At that point,
compare against renting a 4090 at ~$0.40/hr — for a one-off run, renting is
usually cheaper.

## Survive the disconnects

This is the whole difficulty of Colab, and it is handled:

```bash
python scripts/finetune.py --config configs/colab_live.yaml --auto-resume
```

`--auto-resume` finds the newest checkpoint in `output_dir` and continues.
`save_steps: 200` in the Colab config means a lost session costs minutes.

**When it disconnects, just rerun the training cell.** Nothing else.

Keep the tab visible. Colab kills unattended sessions faster than active ones.

## Two things that will waste your time

**1. Copy audio to local disk first.** Reading thousands of small files over the
Drive FUSE mount is far slower than local I/O and will dominate training time:

```python
!cp -r /content/drive/MyDrive/sondanote-asr/audio /content/audio
```

Then rewrite the `audio` paths in your manifest to point at `/content/audio`.

**2. Pin the library versions.** Colab's preinstalled `transformers` drifts and
periodically breaks the PEFT integration. The notebook pins them; don't "upgrade
to latest" when something fails.

## Order of work

1. **Baseline first** (notebook step 6). Without a before-number, the after-number
   means nothing. This is the most commonly skipped step and it invalidates
   everything downstream.
2. Train.
3. Compare — **read CER before WER**. Malayalam is agglutinative, so one wrong
   morpheme fails a whole long word and WER overstates the damage.
4. Check **entity recall**: did your workspace vocabulary terms survive? That
   tracks product value better than a 2-point WER move.

If CER did not improve, **do not scale up**. That is the scaling curve telling you
data is the constraint, not compute — and fine-tuning on too little data
overfits, which measurably makes models worse.

## Using the result

The adapter is ~60MB and saved to Drive. To serve it in Sonda Note, add a provider to
[`apps/api/app/asr.py`](../../apps/api/app/asr.py) implementing the `ASRProvider`
protocol — `transcribe()` returning `ASRResult`. Nothing else in the pipeline
changes.
