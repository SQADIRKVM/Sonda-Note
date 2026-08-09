"""Headless Google Colab Auto-Launcher & Tunnel URL Extractor.

Automates Google Colab execution using Playwright:
1. Loads the Sondanote GPU Notebook in Colab.
2. Authenticates using Google Auth session cookies (stored in secrets).
3. Clicks 'Runtime' -> 'Run all'.
4. Monitors Cell 4 output and extracts the live Cloudflare tunnel URL.
"""
import os
import sys
import time
import re
from playwright.sync_api import sync_playwright

NOTEBOOK_URL = os.getenv("COLAB_NOTEBOOK_URL", "https://colab.research.google.com/")
GOOGLE_COOKIES_JSON = os.getenv("GOOGLE_COOKIES_JSON", "")

def main():
    print("🚀 Starting Headless Google Colab Launcher...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        
        # Inject Google Auth cookies if provided
        if GOOGLE_COOKIES_JSON:
            import json
            try:
                cookies = json.loads(GOOGLE_COOKIES_JSON)
                context.add_cookies(cookies)
                print("🔑 Injected Google Session Cookies successfully.")
            except Exception as e:
                print(f"⚠️ Warning: Failed to parse GOOGLE_COOKIES_JSON: {e}")

        page = context.new_page()
        print(f"🌐 Navigating to Colab Notebook: {NOTEBOOK_URL}")
        page.goto(NOTEBOOK_URL, wait_until="networkidle")

        time.sleep(3)

        # Trigger Runtime -> Run All (Ctrl + F9 or Menu item)
        print("▶️ Triggering 'Run all' execution...")
        try:
            page.keyboard.press("Control+F9")
            time.sleep(2)
            
            # If prompt appears ("Run anyway"), click accept
            dialog_button = page.query_selector("colab-dialog button#ok")
            if dialog_button:
                dialog_button.click()
                print("👍 Clicked 'Run anyway' dialog.")
        except Exception as e:
            print(f"Execution trigger note: {e}")

        print("⏳ Waiting for GPU initialization and Cloudflare Tunnel link...")
        tunnel_url = None
        for attempt in range(60): # Wait up to 5 minutes
            time.sleep(5)
            content = page.content()
            match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", content)
            if match:
                tunnel_url = match.group(0)
                print(f"\n🎉 LIVE TUNNEL URL FOUND: {tunnel_url}\n")
                break
            print(".", end="", flush=True)

        browser.close()

        if tunnel_url:
            # Output for GitHub Actions environment
            github_env = os.getenv("GITHUB_ENV")
            if github_env:
                with open(github_env, "a") as f:
                    f.write(f"NEW_COLAB_URL={tunnel_url}\n")
            return 0
        else:
            print("\n❌ Could not detect Cloudflare Tunnel URL within timeout.")
            return 1

if __name__ == "__main__":
    sys.exit(main())
