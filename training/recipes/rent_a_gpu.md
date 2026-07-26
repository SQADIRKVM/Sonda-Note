# Renting a GPU for the fine-tune

Your M4 (16GB) handles data prep and evaluation. It cannot train a 600M+ model —
Apple MPS lacks the kernels and the memory is short. Rent by the hour.

## Which card

| Card | ~$/hr | Fits LoRA? | Notes |
|---|---|---|---|
| RTX 4090 24GB | $0.35–0.70 | yes | Best value for LoRA. Enough for Whisper-medium |
| A100 40GB | $0.80–1.30 | yes | Comfortable for large-v3 LoRA |
| A100 80GB | $1.07–2.50 | yes | Only needed for FULL fine-tuning |
| H100 | $1.99–3.29 | yes | ~1.5–2x faster; cost per job is roughly a wash |

Providers: RunPod, Vast.ai, Lambda Labs. Avoid hyperscaler on-demand (AWS p4d
quotes up to ~$12/hr for the same silicon).

**Spot/interruptible is fine** — LoRA checkpoints every few hundred steps and
`--resume` picks up where it stopped.

## Run

```bash
# 1. Upload code and manifests (not the audio yet)
rsync -av training/ user@gpu-host:~/training/

# 2. Install
cd ~/training && pip install -r requirements.txt

# 3. Confirm the GPU is visible
python -c "import torch; print(torch.cuda.get_device_name(0))"

# 4. Sanity-check the plan and cost
python scripts/finetune.py --config configs/whisper_ml_lora.yaml --dry-run

# 5. Train (tmux — do not lose it to an SSH drop)
tmux new -s train
python scripts/finetune.py --config configs/whisper_ml_lora.yaml
```

## Cost control

- **Always `--dry-run` first.** It prints estimated GPU-hours and dollars.
- **Start at ~100h of data.** Published scaling curves put the knee at 100–300h;
  a 1000h run is mostly past the point of diminishing returns.
- **Stop the instance.** Idle GPUs bill. This is the most common way to waste
  more on nothing than the training cost.
- LoRA adapters are ~60MB, so download the adapter, not the whole model.

## After training

```bash
# Score against YOUR eval set — the only number that matters
python scripts/evaluate.py --model output/whisper-ml-lora \
                           --manifest data/manifests/sondanote_eval.jsonl
```

Compare CER and entity recall against the base model. **If the delta is small,
do not scale up** — that is the scaling curve telling you the data is the
constraint, not the compute.
