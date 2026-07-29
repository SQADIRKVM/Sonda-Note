#!/usr/bin/env python
"""LoRA fine-tuning for Malayalam / Manglish ASR.

Why LoRA and not full fine-tuning
---------------------------------
Full fine-tuning of Whisper large-v3 on ~1000h costs roughly 300-500 A100-hours
(~$600-2000) and needs an 80GB card. LoRA trains ~1% of parameters, fits in
under 16GB, and costs $30-100. Published scaling curves put the knee of the
Whisper low-resource curve at 100-300 hours, so a 1000h full run spends 20x the
money largely past the point of diminishing returns.

More importantly: fine-tuning on a narrow domain can make things WORSE. On 120h
of maritime data, full fine-tuning degraded every Whisper size (medium 27.8 ->
31.4 WER) through overfitting. Start small, measure against a held-out eval set,
and only scale if the curve says to.

Run this on a rented GPU (RunPod / Lambda / Vast). It will not train on a Mac —
MPS lacks the kernels and 16GB is not enough. Data prep and eval do run locally.

    python finetune.py --config ../configs/whisper_ml_lora.yaml
    python finetune.py --config ../configs/whisper_ml_lora.yaml --dry-run
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Heavy ML imports are deferred into main() so --dry-run and --print-plan work
# on a laptop without torch installed.


@dataclass
class TrainConfig:
    # ── model ──
    # openai/whisper-large-v3      strongest but heaviest; poor on Malayalam untuned
    # openai/whisper-medium        the base IndicWhisper used; good LoRA target
    # ai4bharat/indic-conformer-600m-multilingual   best OPEN Malayalam (26% WER),
    #                              MIT, but uses NeMo rather than transformers —
    #                              see recipes/indicconformer.md
    base_model: str = "openai/whisper-medium"
    language: str = "ml"
    task: str = "transcribe"

    # ── LoRA ──
    # r=32 is a deliberate step up from the usual 8/16. Malayalam is far from
    # Whisper's pretraining distribution, so the adapter needs more capacity
    # than a typical in-domain English task.
    lora_r: int = 32
    lora_alpha: int = 64
    lora_dropout: float = 0.05
    # Attention projections only. Adding MLP layers raises cost for little gain
    # at this scale.
    target_modules: list[str] = field(default_factory=lambda: ["q_proj", "v_proj"])

    # ── data ──
    train_manifest: str = "data/manifests/train.jsonl"
    eval_manifest: str = "data/manifests/eval.jsonl"
    max_duration_s: float = 30.0   # Whisper's window; longer audio is truncated
    min_duration_s: float = 0.5
    sample_rate: int = 16_000

    # ── optimisation ──
    epochs: int = 3                # 2-3 is the consistent convention; more overfits
    per_device_batch_size: int = 8
    gradient_accumulation_steps: int = 2
    learning_rate: float = 1e-3    # LoRA tolerates ~100x the LR of full FT
    warmup_steps: int = 200
    weight_decay: float = 0.01
    gradient_checkpointing: bool = True
    fp16: bool = False
    bf16: bool = True              # prefer bf16 on A100/H100; fp16 risks overflow

    # ── output ──
    output_dir: str = "output/whisper-ml-lora"
    eval_steps: int = 200
    save_steps: int = 400
    logging_steps: int = 25
    seed: int = 42

    @classmethod
    def from_yaml(cls, path: str | Path) -> "TrainConfig":
        import yaml

        with open(path) as fh:
            raw = yaml.safe_load(fh) or {}
        known = {k: v for k, v in raw.items() if k in cls.__dataclass_fields__}
        unknown = set(raw) - set(known)
        if unknown:
            print(f"warning: ignoring unknown config keys: {', '.join(sorted(unknown))}")
        return cls(**known)

    def effective_batch(self) -> int:
        return self.per_device_batch_size * self.gradient_accumulation_steps


def load_manifest(path: str | Path) -> list[dict[str, Any]]:
    """Read a JSONL manifest: {"audio": "...", "text": "...", "duration": 4.2}.

    NeMo's manifest format, which both NeMo and a plain HF pipeline can consume —
    so the same data files work whichever base model you pick.
    """
    entries = []
    with open(path) as fh:
        for line_no, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path}:{line_no} is not valid JSON: {exc}") from None

            # Accept NeMo's key names as aliases so manifests from either
            # ecosystem load without a conversion step.
            if "audio_filepath" in entry and "audio" not in entry:
                entry["audio"] = entry["audio_filepath"]
            if "duration" not in entry:
                entry["duration"] = None

            missing = {"audio", "text"} - entry.keys()
            if missing:
                raise ValueError(f"{path}:{line_no} missing {', '.join(sorted(missing))}")
            entries.append(entry)

    return entries


def summarise(entries: list[dict], name: str) -> str:
    durations = [e["duration"] for e in entries if e.get("duration")]
    hours = sum(durations) / 3600 if durations else 0.0
    chars = sum(len(e["text"]) for e in entries)
    return (
        f"{name:<8} {len(entries):>6} utterances  "
        f"{hours:>7.2f}h  {chars:>9,} chars"
        + ("" if durations else "   (no durations in manifest)")
    )


def print_plan(config: TrainConfig, train: list[dict], evalset: list[dict]) -> None:
    """Cost and time estimate before you spend money on a GPU."""
    hours = sum(e["duration"] for e in train if e.get("duration")) / 3600

    print("\n── plan ──")
    print(f"  base model     {config.base_model}")
    print(f"  LoRA           r={config.lora_r} alpha={config.lora_alpha} on {','.join(config.target_modules)}")
    print(f"  effective batch {config.effective_batch()}")
    print(summarise(train, "train"))
    print(summarise(evalset, "eval"))

    if hours:
        # Anchored on a measured run: ~400h of audio x 2 epochs took 49h on a
        # single RTX 4090 for an 809M model (ivrit.ai). Scaled by epochs and
        # roughly by model size. Order-of-magnitude only.
        audio_hours_processed = hours * config.epochs
        gpu_hours = audio_hours_processed * (49 / 800) * 2
        print(f"\n  audio-hours processed  {audio_hours_processed:.0f}")
        print(f"  est. GPU time          {gpu_hours:.1f}h  (A100/4090, +-50%)")
        # A T4 is roughly 3x slower than a 4090 for fp16 training, and the free
        # Colab tier is where most people will start.
        t4_hours = gpu_hours * 3
        print(f"                         {t4_hours:.1f}h  (Colab free T4)")
        print(f"  est. cost              ${gpu_hours * 1.5:.0f} rented  /  $0 on Colab")

        if t4_hours > 11:
            sessions = int(t4_hours // 11) + 1
            print(
                f"\n  NOTE: ~{t4_hours:.0f}h on a T4 exceeds one Colab session (~12h cap).\n"
                f"  Expect to reconnect and rerun roughly {sessions} times. Use\n"
                "  --auto-resume and checkpoint to Drive so nothing is lost."
            )

        if hours < 10:
            print("\n  NOTE: under 10h of training data. Published curves show gains")
            print("  begin around ~8h but are noisy below ~50h. Expect a weak result;")
            print("  this is worth running to validate the pipeline, not to ship.")
        elif hours > 300:
            print("\n  NOTE: past the knee of the published scaling curve (~100-300h).")
            print("  Most achievable gain is captured earlier — consider training on a")
            print("  subset first and comparing, before paying for the full run.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--config", required=True, help="path to a YAML config")
    parser.add_argument("--dry-run", action="store_true", help="validate data and print the plan, then exit")
    parser.add_argument("--resume", help="checkpoint directory to resume from")
    parser.add_argument(
        "--auto-resume",
        action="store_true",
        help="continue from the newest checkpoint in output_dir if one exists "
        "(use this on Colab, where sessions disconnect without warning)",
    )
    args = parser.parse_args()

    config = TrainConfig.from_yaml(args.config)
    root = Path(args.config).parent.parent

    train_path = root / config.train_manifest
    eval_path = root / config.eval_manifest

    for path, label in [(train_path, "train"), (eval_path, "eval")]:
        if not path.exists():
            print(f"error: {label} manifest not found at {path}")
            print("       run scripts/prepare_data.py first")
            return 1

    train = load_manifest(train_path)
    evalset = load_manifest(eval_path)

    if not train:
        print("error: training manifest is empty")
        return 1

    print_plan(config, train, evalset)

    if args.dry_run:
        print("\ndry run — nothing trained")
        return 0

    # ── real training below; needs a CUDA GPU ──
    try:
        import torch
        from datasets import Audio, Dataset
        from peft import LoraConfig, get_peft_model
        from transformers import (
            Seq2SeqTrainer,
            Seq2SeqTrainingArguments,
            WhisperForConditionalGeneration,
            WhisperProcessor,
        )
    except ImportError as exc:
        print(f"\nerror: training dependencies missing ({exc.name})")
        print("       pip install -r training/requirements.txt")
        print("       (this step needs a CUDA GPU — see recipes/rent_a_gpu.md)")
        return 1

    if not torch.cuda.is_available():
        print("\nerror: no CUDA GPU detected.")
        print("       Apple MPS cannot train this model.")
        print("       Free option: training/recipes/colab.md (Colab T4)")
        print("       Paid option: training/recipes/rent_a_gpu.md")
        return 1

    gpu_name = torch.cuda.get_device_name(0)
    vram_gb = torch.cuda.get_device_properties(0).total_memory / 1024**3
    major, minor = torch.cuda.get_device_capability(0)
    print(f"\ngpu: {gpu_name}  ({vram_gb:.0f}GB, compute {major}.{minor})")

    # bf16 needs Ampere (sm_80) or newer.
    #
    # Do NOT use torch.cuda.is_bf16_supported() here: it defaults to
    # including_emulation=True and therefore returns True on a T4, which has no
    # bf16 hardware. Acting on that picks a config the card cannot run, and the
    # resulting OOM points nowhere near the real cause. Check the capability.
    has_bf16 = major >= 8
    if config.bf16 and not has_bf16:
        print(f"  note: {gpu_name} (compute {major}.{minor}) has no bf16 hardware "
              "— switching to fp16")
        config.bf16, config.fp16 = False, True

    if config.fp16 and config.bf16:
        print("  note: fp16 and bf16 both set — preferring bf16")
        config.fp16 = False

    # Whisper-medium LoRA in fp16 peaks around 11-13GB at batch 2. Warn rather
    # than fail, because the peak depends on utterance length in the batch.
    if vram_gb < 20 and config.per_device_batch_size > 2:
        print(
            f"  warning: batch {config.per_device_batch_size} on {vram_gb:.0f}GB "
            "is likely to OOM.\n"
            "           Use configs/whisper_ml_lora_colab.yaml, or lower "
            "per_device_batch_size\n"
            "           and raise gradient_accumulation_steps to keep the "
            "effective batch."
        )

    processor = WhisperProcessor.from_pretrained(
        config.base_model, language=config.language, task=config.task
    )
    # Load in fp32 and let the Trainer's AMP handle mixed precision. Loading the
    # weights directly in fp16 gives NaN losses (fp16 lacks the range for the
    # master weights), and bf16 weights on a card without bf16 hardware are
    # emulated and slow.
    model = WhisperForConditionalGeneration.from_pretrained(
        config.base_model,
        torch_dtype=torch.bfloat16 if (config.bf16 and has_bf16) else torch.float32,
    )

    # Whisper defaults to auto-detecting language and will happily switch to
    # translation. Pin both, or it silently translates Malayalam into English —
    # the exact failure mode measured on the Manglish benchmark.
    model.generation_config.language = config.language
    model.generation_config.task = config.task
    model.generation_config.forced_decoder_ids = None

    # KV caching is incompatible with gradient checkpointing. Turn it off here
    # rather than letting the Trainer discover it and patch it mid-run.
    model.config.use_cache = False

    if config.gradient_checkpointing:
        # REQUIRED for LoRA + gradient checkpointing.
        #
        # LoRA freezes ~99% of the model, so no input to a checkpointed block
        # requires grad. Autograd then builds no graph for that segment and
        # backward() dies with:
        #     "element 0 of tensors does not require grad and does not have a
        #      grad_fn"
        # This hook makes the embedding output require grad, which reconnects
        # the graph. It must run BEFORE get_peft_model().
        model.enable_input_require_grads()

    lora = LoraConfig(
        r=config.lora_r,
        lora_alpha=config.lora_alpha,
        target_modules=config.target_modules,
        lora_dropout=config.lora_dropout,
        bias="none",
        # NO task_type. It looks like it belongs here — Whisper is an
        # encoder-decoder — but SEQ_2_SEQ_LM makes PEFT wrap the model in
        # PeftModelForSeq2SeqLM, whose forward() hardcodes `input_ids=`.
        # Whisper takes `input_features=`, so every step dies with
        # "got multiple values for keyword argument 'input_ids'".
        # Verified on peft 0.19.1: omitting it trains correctly.
    )
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    def to_dataset(entries: list[dict]) -> "Dataset":
        keep = [
            e for e in entries
            if not e.get("duration")
            or config.min_duration_s <= e["duration"] <= config.max_duration_s
        ]
        dropped = len(entries) - len(keep)
        if dropped:
            print(f"  dropped {dropped} utterances outside "
                  f"[{config.min_duration_s}, {config.max_duration_s}]s")
        ds = Dataset.from_list([{"audio": e["audio"], "text": e["text"]} for e in keep])
        return ds.cast_column("audio", Audio(sampling_rate=config.sample_rate))

    def prepare(batch):
        audio = batch["audio"]
        batch["input_features"] = processor.feature_extractor(
            audio["array"], sampling_rate=audio["sampling_rate"]
        ).input_features[0]
        batch["labels"] = processor.tokenizer(batch["text"]).input_ids
        return batch

    train_ds = to_dataset(train).map(prepare, remove_columns=["audio", "text"])
    eval_ds = to_dataset(evalset).map(prepare, remove_columns=["audio", "text"])

    from collate import DataCollatorSpeechSeq2Seq  # local module

    trainer = Seq2SeqTrainer(
        model=model,
        args=Seq2SeqTrainingArguments(
            output_dir=config.output_dir,
            per_device_train_batch_size=config.per_device_batch_size,
            gradient_accumulation_steps=config.gradient_accumulation_steps,
            learning_rate=config.learning_rate,
            warmup_steps=config.warmup_steps,
            num_train_epochs=config.epochs,
            weight_decay=config.weight_decay,
            gradient_checkpointing=config.gradient_checkpointing,
            # use_reentrant=False is the non-legacy checkpointing implementation.
            # The reentrant one cannot track which inputs need grad and is the
            # other half of the LoRA "does not require grad" failure; it is also
            # deprecated upstream.
            gradient_checkpointing_kwargs={"use_reentrant": False},
            bf16=config.bf16,
            fp16=config.fp16,
            eval_strategy="steps",
            eval_steps=config.eval_steps,
            save_steps=config.save_steps,
            logging_steps=config.logging_steps,
            seed=config.seed,
            report_to=[],
            remove_unused_columns=False,
            label_names=["labels"],
        ),
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        data_collator=DataCollatorSpeechSeq2Seq(processor),
    )

    resume_from = args.resume
    if args.auto_resume and not resume_from:
        # Colab kills sessions at ~12h and idle-disconnects sooner. Picking up
        # the newest checkpoint automatically means a dropped session costs the
        # minutes since the last save rather than the whole run.
        checkpoints = sorted(
            Path(config.output_dir).glob("checkpoint-*"),
            key=lambda p: int(p.name.split("-")[-1]) if p.name.split("-")[-1].isdigit() else -1,
        )
        if checkpoints:
            resume_from = str(checkpoints[-1])
            print(f"\nauto-resume: continuing from {checkpoints[-1].name}")
        else:
            print("\nauto-resume: no checkpoint found — starting fresh")

    trainer.train(resume_from_checkpoint=resume_from)

    model.save_pretrained(config.output_dir)
    processor.save_pretrained(config.output_dir)
    print(f"\nadapter saved to {config.output_dir}")
    print("evaluate with:  python scripts/evaluate.py --model", config.output_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
