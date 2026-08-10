# ⏰ Cron Job & Keep-Alive Setup Tutorial for Sonda Note

> **Complete guide to automating periodic health checks, preventing Google Colab GPU timeouts, and setting up static URLs.**

---

## ❓ Will the GPU Server Link Change Every Time?

### Short Answer:
* **By default (Free Random ngrok/Localtunnel): YES.** Every time Google Colab restarts or dislocates, a new random URL is generated (e.g. `https://a1b2-34-125-xx-xx.ngrok-free.app`).
* **With a Free Static Domain: NO!** You can set up a **100% free permanent domain** so the link **NEVER changes**, even when Colab restarts.

---

## 🔑 How to Set Up a Permanent Static URL (Free)

### Method A: ngrok Free Static Domain (Recommended)
ngrok provides **1 free static domain** per free account:

1. Sign up at **[ngrok.com](https://ngrok.com)**.
2. Go to **Domains** in the left sidebar and claim your free static domain (e.g., `sondanote-gpu.ngrok-free.app`).
3. Copy your `AUTHTOKEN` from the ngrok dashboard.
4. In your Colab notebook (`Sondanote_GPU_Inference_Server.ipynb`), run:

```python
!ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
!ngrok http 8000 --domain=sondanote-gpu.ngrok-free.app
```

Now your GPU server URL will **always** be `https://sondanote-gpu.ngrok-free.app`. It will **never change** when you restart Colab!

---

### Method B: Localtunnel Custom Subdomain (Free)
Localtunnel allows requesting a fixed subdomain:

```bash
npx localtunnel --port 8000 --subdomain sondanote-gpu-kerala
```

Your URL will remain `https://sondanote-gpu-kerala.loca.lt`.

---

## 📌 Overview

Sonda Note utilizes open-weights GPU models (Whisper Large V3 + Qwen 2.5) running on Google Colab or external servers. Google Colab free T4 instances disconnect if left idle for extended periods.

This tutorial covers **three methods** to set up cron jobs and automated ping schedules to keep your GPU inference server active and healthy:

1. **GitHub Actions (Recommended · Cloud-native & 24/7 Free)**
2. **System Crontab (Linux / macOS / VPS)**
3. **Web Cron Services (UptimeRobot / cron-job.org)**

---

## ⏱️ Cron Syntax Quick Reference

A standard cron expression consists of **5 fields**:

```text
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday = 0 or 7)
│ │ │ │ │
* * * * *
```

### Common Examples

| Schedule | Cron Expression | Use Case |
|---|---|---|
| Every 15 minutes | `*/15 * * * *` | Colab GPU server keep-alive ping |
| Every hour | `0 * * * *` | Hourly database health check |
| Everyday at midnight | `0 0 * * *` | Daily backup & log rotation |
| Mon-Fri at 9 AM | `0 9 * * 1-5` | Standup reminder |

---

## ⚡ Method 1: GitHub Actions (Recommended)

Sonda Note comes pre-configured with a GitHub Actions workflow located at [`.github/workflows/colab-keepalive.yml`](.github/workflows/colab-keepalive.yml).

### Step 1: Open Your Repository Settings
1. Navigate to your repository on GitHub: `https://github.com/YOUR_USERNAME/Sonda-Note`
2. Click **Settings** → **Secrets and variables** → **Actions**.

### Step 2: Add the `COLAB_GPU_URL` Secret
1. Click **New repository secret**.
2. **Name:** `COLAB_GPU_URL`
3. **Secret:** Your permanent static URL (e.g. `https://sondanote-gpu.ngrok-free.app`).
4. Click **Add secret**.

### Step 3: Verify the Workflow
1. Click the **Actions** tab on your GitHub repository.
2. Select **Colab GPU Server Keep-Alive & Health Check** from the left sidebar.
3. Click **Run workflow** → **Run workflow** (manual trigger via `workflow_dispatch`).
4. The workflow will automatically execute every 15 minutes on schedule (`*/15 * * * *`).

```yaml
name: Colab GPU Server Keep-Alive & Health Check

on:
  schedule:
    - cron: '*/15 * * * *'
  workflow_dispatch:

jobs:
  ping-colab-gpu:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Ping Colab GPU Server
        env:
          COLAB_GPU_URL: ${{ secrets.COLAB_GPU_URL }}
        run: |
          if [ -z "$COLAB_GPU_URL" ]; then
            echo "::warning title=COLAB_GPU_URL Not Set::Please set COLAB_GPU_URL in GitHub Repository Secrets."
            exit 0
          fi
          
          echo "Pinging live GPU server at: $COLAB_GPU_URL/health"
          RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$COLAB_GPU_URL/health" || echo "000")
          
          if [ "$RESPONSE" -eq 200 ]; then
            echo "✅ Colab GPU Server is LIVE and healthy (HTTP 200)."
            exit 0
          else
            echo "❌ Colab GPU Server failed or timed out (HTTP Status: $RESPONSE)."
            exit 1
          fi
```

---

## 💻 Method 2: System Crontab (Linux / macOS)

If you run a local development machine or a VPS (like Ubuntu on AWS / DigitalOcean), you can use the system `crontab`.

### Step 1: Open Crontab Editor

```bash
crontab -e
```

### Step 2: Add Keep-Alive Cron Rule

To ping your GPU server every 15 minutes and log output to `/tmp/colab-ping.log`:

```bash
*/15 * * * * curl -s -o /dev/null -w "%{http_code} %{time_total}\n" https://sondanote-gpu.ngrok-free.app/health >> /tmp/colab-ping.log 2>&1
```

### Useful Commands for Crontab

```bash
# List all active cron jobs
crontab -l

# View ping execution log
tail -f /tmp/colab-ping.log

# Remove all cron jobs
crontab -r
```

---

## 🌐 Method 3: Web-Based Cron Services (Zero-Code)

If you prefer a web UI without maintaining shell scripts or GitHub secrets:

### Option A: UptimeRobot (Free)
1. Register at [uptimerobot.com](https://uptimerobot.com).
2. Click **Add New Monitor**.
3. **Monitor Type:** HTTP(s)
4. **Friendly Name:** `Sonda Note GPU Server`
5. **URL (or IP):** `https://sondanote-gpu.ngrok-free.app/health`
6. **Monitoring Interval:** `5 minutes` or `15 minutes`.
7. Click **Create Monitor**.

### Option B: cron-job.org (Free)
1. Sign up at [cron-job.org](https://cron-job.org).
2. Click **Create Cronjob**.
3. **Title:** `Sonda Note Colab Keepalive`
4. **Address:** `https://sondanote-gpu.ngrok-free.app/health`
5. **Schedule:** Every 15 minutes.

---

## 🔍 Troubleshooting & Best Practices

1. **Google Colab Max Duration Limits:**
   * Free Colab instances disallow running continuously for more than **12 hours**. Keep-alive ping prevents idle timeouts (20-30 min inactivity), but you will still need to restart the notebook once a day.
2. **Static Domain vs Random URL:**
   * If using a static ngrok domain, you never need to edit your secret or cron job again!
3. **Handling CORS & Auth:**
   * Ensure `/health` endpoint on FastAPI returns HTTP 200 without requiring Bearer auth headers so simple ping monitors can verify server status.
