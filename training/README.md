# Sonda Note ASR training

Self-hosted Malayalam / Manglish speech recognition. No vendor API, no per-minute
billing — you fine-tune open weights and run them on your own hardware.

---

## Read this before you spend money

Four findings from verifying the research. Each one changes the plan.

**1. "From scratch" is not viable, and you don't need it.** Training ASR from
random initialisation needs 10,000+ hours. There are ~422 hours of permissively
licensed Malayalam speech in existence. Fine-tuning open weights (MIT/Apache)
gives you a model you own, self-host, and ship — with no API dependency. That is
"your own model" in every sense that matters commercially.

**2. There is essentially no code-mixed Malayalam-English speech data.** One
public corpus exists: [MLENSPEECH](https://github.com/erose311/Malayalam-English-Speech-Dataset),
**3 hours 20 minutes**, 5 speakers. On the only Manglish benchmark that exists,
the best system scores **48.6% WER** and Whisper-medium scores **111%** — it
*translates* instead of transcribing. Manglish ASR is an open research problem,
not a tuning exercise.

**3. Fine-tuning can make things worse.** On 120h of narrow-domain data,
full fine-tuning degraded *every* Whisper size ([arXiv 2410.18363](https://arxiv.org/html/2410.18363):
medium 27.8 → 31.4 WER) through overfitting, while a biasing layer improved the
same model to 11.1. Published scaling curves put the knee at **100–300 hours** —
a 1000h run spends 20× the money mostly past the point of diminishing returns.

**4. WER will mislead you on Malayalam.** The language is agglutinative, so one
wrong morpheme fails an entire long word. [NAACL 2025](https://aclanthology.org/2025.findings-naacl.277.pdf)
(human eval, Malayalam included) found **CER tracks human judgement better than
WER**. This repo reports both and tells you to trust CER.

> Demonstration from `eval/metrics.py` — one wrong final morpheme:
> **WER 33.3%** vs **CER 4.5%**. Judging by WER you would call this model broken.

---

## The order to do things in

```
1. Build an eval set   ← START HERE. Costs nothing. Nobody else has one.
2. Measure what you already have (base models + your vocabulary layer)
3. LoRA fine-tune                 (free on Colab, or ~$20-100 rented)
4. Compare against step 2. Only scale if the delta justifies it.
```

Skipping step 1 means you cannot tell whether steps 3–4 helped.

---

## 1. Build your eval set

This is the highest-value artifact here and the one no competitor has. Your own
Kerala meeting audio, corrected by the people who were in the meeting.

```bash
cd training/scripts
../../apps/api/.venv/bin/python build_evalset.py --out ../data/manifests/sondanote_eval.jsonl
```

It exports only **human-corrected** segments by default — an untouched segment is
not evidence the ASR was right. Users already correct transcripts in the
dashboard (it feeds the workspace vocabulary), so this asset accumulates for free
as a side effect of normal product use.

| Hours | What it's good for |
|---|---|
| < 0.5 h | Nothing yet — keep recording |
| ~2 h | Smoke-testing model changes |
| ~20 h | A genuine benchmark, and a real competitive asset |

Prioritise meetings with heavy English↔Malayalam switching; the script reports a
`code-mix ratio` and warns if your set is mostly monolingual.

## 2. Measure before you train

```bash
python3 -c "
import sys, json; sys.path.insert(0,'eval')
from metrics import evaluate
pairs = [(d['text'], d['raw_text']) for d in map(json.loads, open('data/manifests/sondanote_eval.jsonl'))]
print(evaluate(pairs, vocabulary=['Sonda Note','Supabase','Figma','Razorpay']).summary())
"
```

Reports WER, CER, a per-script breakdown (Malayalam / English / **intra-word
mixed**), and **entity recall** — how many workspace vocabulary terms survived.

Entity recall is the metric that tracks product value. Users don't notice a
2-point WER move; they notice whether their client's name came out right.

## 3. Fine-tune

```bash
# Validate data and estimate time/cost — runs on your laptop, no GPU:
python scripts/finetune.py --config configs/whisper_ml_lora.yaml --dry-run
```

LoRA trains ~1% of parameters and fits in under 16GB, so a **free Colab T4 is
enough** for a first run.

| Where | Cost | Good for |
|---|---|---|
| **[Google Colab](recipes/colab.md)** (free T4) | **$0** | Up to ~30h of audio |
| [Rented GPU](recipes/rent_a_gpu.md) (4090/A100) | $20–100 | More than ~30h |

The crossover is about **30 hours of audio**: below it Colab is free and fine,
above it you spend days reconnecting to save the price of a meal. `--dry-run`
prints both estimates so you can decide with a number rather than a guess.

**Colab:** open [`notebooks/sondanote_finetune_colab.ipynb`](notebooks/sondanote_finetune_colab.ipynb)
and run it top to bottom. It handles the T4's lack of bf16, checkpoints to Drive,
and auto-resumes after the inevitable disconnect.

---

## Which base model

| Model | Malayalam WER | Licence | Notes |
|---|---|---|---|
| **IndicConformer 600M** | **26.0%** | **MIT** | Best open option. NeMo-based — see [`recipes/indicconformer.md`](recipes/indicconformer.md) |
| Whisper medium | ~35–40% | MIT | Easiest to fine-tune, huge ecosystem |
| Whisper large-v3 | worse untuned | MIT | Heavy; needs the most adaptation for Indic |

WERs from [Voice of India](https://arxiv.org/html/2604.19151v2) (45h real
conversational Malayalam, independent). For reference, the best commercial API
scores 18.9% — that is the bar an in-house model is chasing.

Avoid Whisper large-v3-**turbo**: only 4 decoder layers, and Malayalam errors are
dominated by decoder-side character substitution — exactly the wrong trade.

---

## Data

`python data/sources.py` prints the verified registry with sizes and licences.

**Traps it exists to prevent:**

- **`emhaihsan/Synth-Manglish` is MALAY-English**, not Malayalam. Most "Manglish"
  search hits are Malaysian.
- **swaram.live is not a dataset** — it's a closed commercial API (Pattern AI
  Labs, Kochi, ~₹0.99/min). Nothing to download.
- **OpenSLR 63 is ~3 hours** and Common Voice Malayalam has **2.9 validated
  hours**. Together they are an eval set, not training data.
- **IndicVoices' 23.7K hours** is raw audio across 22 languages; transcribed
  Malayalam is **~60h**.
- **CC-BY-SA is copyleft.** IMaSC (50h) and OpenSLR 63 are share-alike and are
  quarantined from the permissive tier on purpose.

| Tier | Hours | Use |
|---|---|---|
| Permissive Malayalam speech | **422 h** | Training |
| Public code-mixed speech | **3.3 h** | Eval only — the bottleneck |
| Meeting-domain (AMI + ICSI, English) | 172 h | Diarization, meeting dynamics |

ICSI is **free** from Edinburgh's mirror — don't pay LDC's catalogue fee for the
same data.

---

## Layout

```
training/
  eval/metrics.py          WER + CER + code-mix breakdown + entity recall
  data/sources.py          verified dataset registry with licences
  scripts/
    build_evalset.py       export your recordings as an eval manifest
    finetune.py            LoRA fine-tuning
    collate.py             seq2seq batching
  configs/
    whisper_ml_lora.yaml       A100 / 4090
    whisper_ml_lora_colab.yaml free T4 (fp16, batch 2)
  notebooks/               Colab notebook, runs end to end
  recipes/                 Colab, GPU rental, IndicConformer
```

---

## Honest assessment

Fine-tuning on ~400h of read-speech Malayalam will improve monolingual Malayalam
meaningfully. It will do **much less** for code-mixed Manglish, because the
training data for that essentially does not exist.

The highest-leverage work is not the fine-tune. It is:

1. **Your eval set** — you cannot improve what you cannot measure, and no
   public Manglish benchmark exists.
2. **Your vocabulary layer** — already built, and measurable. On the demo data,
   raw ASR got **0 of 9** product names right; the cleaner recovered all of them.
   No amount of fine-tuning delivers that for a per-workspace term.

Train because the eval set says it helps, not because it feels like the serious
thing to do.
