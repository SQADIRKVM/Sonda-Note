# 🎯 Sonda Note — Fine-Tuning & Model Optimization Specification

**Document Version**: 1.0.0  
**Target Architecture**: General Malayalam & Manglish Meeting Intelligence (Tech, Business, Legal, Real Estate)

---

##  EXECUTIVE SUMMARY & PHILOSOPHY

> **"Do not train AI from scratch. Build an enterprise system around open weights."**

For a lean engineering team, training an ASR (Automatic Speech Recognition) model from scratch requires 10,000+ hours of speech and multi-million dollar compute budgets. Instead, **Sonda Note** uses **Whisper Large V3** fine-tuned via **LoRA (Low-Rank Adaptation)** paired with a **Workspace Vocabulary Moat** (`cleaner.py`).

---

## 1. PUBLIC MODEL & DATASET EVALUATION

### A. Public Hugging Face Malayalam Models (Why we don't use them directly)
- `adalat-ai/whisper-medium-ml-rmft`
- `thennal/whisper-medium-ml`

**Finding**: While these models improve WER on formal, read Malayalam (e.g. news reading, books), they **severely degrade on code-mixed Malayalam-English (Manglish) meetings**. They attempt to force-translate technical and business terms into formal Malayalam script (e.g., converting *"Postgres migration"* or *"Razorpay API"* into garbled Malayalam words).

### B. Public Dataset Strategy
Public datasets (OpenSLR 63, Kathbath, Mozilla Common Voice) provide base Malayalam phonetics, but zero meeting code-mixing. 

**Correct Usage**: Use public datasets **strictly for baseline pre-training / evaluation**, while your proprietary dataset is generated directly from user corrections in the dashboard (`training/data/manifests/sondanote_eval.jsonl`).

---

## 2. LORA FINE-TUNING PIPELINE (`training/`)

### A. Why LoRA over Full Fine-Tuning
1. **Prevents Catastrophic Forgetting**: Full fine-tuning degrades multilingual performance. LoRA updates ~1% of parameters (`q_proj`, `v_proj`), preserving Whisper's core capability while learning local accent variations.
2. **Compute Efficiency**: Fits inside **16 GB VRAM** (free Google Colab T4 GPU or single rented A100 GPU).
3. **$0 GPU Training**: Can be executed entirely on Google Colab T4 GPU in 1.5–2 hours.

---

## 3. STEP-BY-STEP LORA FINE-TUNING EXECUTION

### Step 1: Prepare Public + Proprietary Datasets
```bash
cd training/scripts
python fetch_public_data.py --dataset imasc --hours 50
python fetch_public_data.py --dataset common_voice --hours 3
python build_evalset.py --out ../data/manifests/sondanote_eval.jsonl
```

### Step 2: Combine Manifests
```bash
cat ../data/manifests/train.jsonl ../data/manifests/sondanote_eval.jsonl > ../data/manifests/combined_train.jsonl
```

### Step 3: Run LoRA Fine-Tuning on Colab
Upload and execute `training/scripts/finetune.py`:
```bash
python finetune.py \
    --config ../configs/whisper_ml_lora.yaml \
    --base-model openai/whisper-large-v3 \
    --train-manifest ../data/manifests/combined_train.jsonl
```

### Step 4: Export Weights to Faster-Whisper (CTranslate2)
Convert the fine-tuned adapter into `CTranslate2` format for low-latency inference:
```bash
ct2-transformers-converter --model ./checkpoints/whisper-ml-lora --output_dir ./models/whisper-ml-general-ct2
```

---

## 4. METRICS & ACCURACY BENCHMARKING

Evaluate your fine-tuned model against your held-out meeting dataset:
```bash
python evaluate.py --manifest ../data/manifests/sondanote_eval.jsonl
```

- **CER (Character Error Rate)**: Primary metric for agglutinative languages like Malayalam.
- **WER (Word Error Rate)**: Secondary metric.
- **Entity Recall**: Measures percentage of company names, technical terms, and client names correctly transcribed.
