# 🎙️ Sonda Note — Indian Meeting Intelligence

> **Malayalam & Manglish First · Multi-Platform (Google Meet, Zoom, MS Teams) · 100% Free / Open Source GPU Stack (Neon DB + Google Colab T4 GPU)**

Sonda Note is an end-to-end meeting intelligence platform built specifically for Indian tech, business, and enterprise teams. It records live meeting audio across platforms, transcribes Malayalam-English (Manglish) code-mixed speech with Whisper Large V3, cleans transcripts with a custom workspace domain vocabulary layer, and generates structured meeting summaries and action items using open-weights LLMs (Qwen 2.5:7b / Llama 3.3).

---

## 🚀 Key Features & Highlights

- 📹 **Multi-Platform Recording**: Record meetings directly in Chrome on **Google Meet**, **Zoom Web**, and **Microsoft Teams Web** via standard browser audio merging.
- ⚡ **100% Free Self-Hosted Stack**: Run **Whisper Large V3** (ASR) + **Qwen 2.5:7b** (LLM) on a **free Google Colab T4 GPU** — $0.00 API cost.
- 🐘 **Neon DB Integration**: Production-ready serverless PostgreSQL via [Neon.tech](https://neon.tech) (`BACKEND=neon`) or zero-config local SQLite (`BACKEND=local`).
- 🎯 **Malayalam / Manglish Custom Vocabulary Moat**: Automatic domain-specific term cleaning (e.g. correcting "figure ma" → "Figma", "post grass" → "Postgres", "raise pay" → "Razorpay").
- 📊 **Enterprise Dashboard**: Built with Next.js 15, dynamic meeting summaries, action item tracking, workspace vocabulary management, and transcript editing.
- 🧪 **Fine-Tuning Framework**: Built-in evaluation and LoRA fine-tuning suite (`training/`) to measure WER/CER and fine-tune open weights.

---

## 🏗️ Architecture Overview

```
 Google Meet / Zoom / MS Teams Tab
               │
               ▼
 ┌───────────────────────────────────────────┐
 │ Chrome Extension (Plasmo · Manifest V3)   │
 │   background.ts  orchestration & auth     │
 │   offscreen.ts   tab + mic audio merge    │
 │                  → 30s WebM chunks        │
 └─────────────────────┬─────────────────────┘
                       │ WebSocket (JWT authenticated)
                       ▼
 ┌───────────────────────────────────────────┐
 │ FastAPI Backend (`apps/api`)              │
 │   ffmpeg    → 16kHz mono WAV merge        │
 │   ASR       → Whisper Large V3            │
 │   cleaner   → workspace vocabulary moat   │
 │   LLM       → Qwen 2.5:7b / Llama 3.3     │
 └─────────┬───────────────────────┬─────────┘
           │                       │
           ▼                       ▼
 ┌───────────────────┐   ┌───────────────────────────────┐
 │ Neon DB / SQLite  │   │ Google Colab GPU Server       │
 │ Serverless Postgres│   │ (Free T4 GPU via Cloudflare) │
 └───────────────────┘   └───────────────────────────────┘
           │
           ▼
 ┌───────────────────────────────────────────┐
 │ Next.js 15 Web Dashboard (`apps/web`)    │
 │   meetings · transcript · tasks · vocab   │
 └───────────────────────────────────────────┘
```

---

## 📁 Full Repository Structure

```
meet-ai/
├── apps/
│   ├── api/                        # FastAPI Python backend
│   │   ├── app/
│   │   │   ├── asr.py              # Swappable ASR providers (Colab GPU, Groq)
│   │   │   ├── auth_routes.py      # Local/Neon JWT authentication endpoints
│   │   │   ├── cleaner.py           # Domain vocabulary cleaner & string replacements
│   │   │   ├── config.py           # Environment settings & Pydantic validation
│   │   │   ├── db.py               # Database dispatcher (Local SQLite, Neon DB, Supabase)
│   │   │   ├── local_store.py      # SQLite local database driver
│   │   │   ├── postgres_store.py   # Neon / PostgreSQL database driver
│   │   │   ├── llm.py              # Swappable LLM providers (Colab/Ollama, Groq, Gemini)
│   │   │   ├── main.py             # FastAPI entrypoint & startup recovery
│   │   │   ├── pipeline.py         # Full audio-to-intelligence pipeline runner
│   │   │   └── routes.py           # API endpoints (meetings, summaries, vocab, tasks)
│   │   ├── .env.example            # Backend environment template
│   │   ├── requirements.txt        # Python dependencies
│   │   └── seed_demo.py            # Demo workspace data seeder
│   │
│   ├── extension/                  # Chrome Extension (Plasmo MV3)
│   │   ├── src/
│   │   │   ├── background.ts       # Service worker & tab injection orchestration
│   │   │   ├── offscreen.ts        # TabCapture + getUserMedia Web Audio merger
│   │   │   ├── popup.tsx           # Extension popup UI (Start/Stop recording)
│   │   │   └── contents/           # Injected content scripts (Meet, Zoom, Teams)
│   │   ├── .env.example            # Extension environment template
│   │   └── package.json            # Extension dependencies & build scripts
│   │
│   └── web/                        # Next.js 15 Web Dashboard
│       ├── app/
│       │   ├── login/              # Sign in / Sign up page
│       │   ├── meetings/           # Meetings list & detail view ([id])
│       │   ├── tasks/              # Action items management
│       │   └── vocabulary/         # Domain vocabulary term editor
│       ├── .env.example            # Next.js environment template
│       └── package.json            # Web app dependencies & build scripts
│
├── training/                       # Fine-Tuning & Evaluation Suite
│   ├── configs/                    # LoRA fine-tuning YAML configurations
│   ├── scripts/
│   │   ├── build_evalset.py        # Export human-corrected transcripts to evalset
│   │   ├── evaluate.py             # Compute WER, CER & entity recall metrics
│   │   └── finetune.py             # LoRA fine-tuning runner for Whisper models
│   └── README.md                   # Evaluation & fine-tuning research guide
│
├── Sonda Note_GPU_Inference_Server.ipynb# Google Colab GPU Inference Server notebook
├── fine-tune.md                    # Fine-tuning specification & model evaluation guide
├── README.md                       # Main project documentation
└── product_audit_and_roadmap.md    # Product strategy & roadmap
```

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- **Node.js**: `v20+`
- **Python**: `v3.11+`
- **FFmpeg**: Installed locally (`ffmpeg -version` or `brew install ffmpeg`)

---

### 2. Backend Setup (`apps/api`)

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

**Choose your Database (`apps/api/.env`)**:
- **Local (SQLite)**: `BACKEND=local` (Zero setup, runs out of the box).
- **Neon DB (Postgres)**: Set `BACKEND=neon` and paste your Neon connection string:
  ```env
  BACKEND=neon
  DATABASE_URL=postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require
  ```

Start the FastAPI dev server:
```bash
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```
- API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

---

### 3. GPU Inference Server Setup (Google Colab — 100% Free)

To run Whisper Large V3 & Qwen 2.5:7b on free GPU hardware:

1. Open [`Sondanote_GPU_Inference_Server.ipynb`](file:///Users/sarhanqadir/Downloads/meet-ai/Sondanote_GPU_Inference_Server.ipynb) in **Google Colab**.
2. Go to **Runtime → Change runtime type → T4 GPU**.
3. Click **Runtime → Run all**.
4. Copy the live tunnel URL printed at the end of Cell 4:
   ```text
   ========================================================
     🚀 SONDANOTE GPU SERVER IS LIVE!
     URL: https://your-tunnel-id.trycloudflare.com
   ========================================================
   ```
5. Update `apps/api/.env`:
   ```env
   COLAB_GPU_URL=https://your-tunnel-id.trycloudflare.com
   ASR_PROVIDER=colab
   LLM_PROVIDER=colab
   ```

---

### 4. Web Dashboard Setup (`apps/web`)

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```
Open `http://localhost:3000` to log in, view recorded meetings, edit transcripts, and manage workspace vocabulary.

---

### 5. Chrome Extension Setup (`apps/extension`)

```bash
cd apps/extension
npm install
cp .env.example .env
npm run build
```
1. Open Google Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked** and select `apps/extension/build/chrome-mv3-prod`.
4. Open Google Meet, Zoom Web, or MS Teams Web and click the extension icon to start recording!

---

## 🧪 Testing & Verification

Run the full backend test suite:
```bash
cd apps/api
.venv/bin/pytest
```
*All 103 unit tests verify ASR provider routing, LLM generation, domain term cleaning, and database persistence.*

---

## 📜 License
MIT License — Free for commercial and personal use.
