/**
 * Content script on Google Meet — floating record pill.
 *
 * Designed to match Sonda Note's warm paper design system:
 * - Warm paper pill background (#FFFDF8)
 * - Hairline border (#E4E1D8) with hover accent (#5F6E24)
 * - Georgia serif display typography & clean badges
 */

import type { PlasmoCSConfig } from "plasmo";

import type { PopupStatus } from "../lib/types";

export const config: PlasmoCSConfig = {
  matches: [
    "https://meet.google.com/*",
    "https://*.zoom.us/*",
    "https://teams.microsoft.com/*",
    "https://teams.live.com/*"
  ],
  run_at: "document_idle",
};

const HOST_ID = "sondanote-meet-pill";
let shadow: ShadowRoot | null = null;
let pollTimer: number | null = null;

function mount(): void {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText =
    "position:fixed;bottom:96px;right:20px;z-index:2147483000;pointer-events:auto;";
  shadow = host.attachShadow({ mode: "closed" });
  document.body.appendChild(host);

  const style = document.createElement("style");
  style.textContent = `
    .pill {
      display:flex; align-items:center; gap:9px;
      background:#FFFDF8; border:1px solid #E4E1D8; border-radius:999px;
      padding:10px 18px; cursor:pointer; user-select:none;
      font-family:system-ui,-apple-system,sans-serif; font-size:13px; font-weight:500;
      color:#191A14; box-shadow:0 4px 20px rgba(25,26,20,.12);
      transition:border-color .18s, transform .18s, background-color .18s;
    }
    .pill:hover { border-color:#5F6E24; transform:translateY(-1px); background:#F7F4EE; }
    .pill[data-disabled="true"] { opacity:.5; cursor:default; transform:none; }
    .dot { width:8px; height:8px; border-radius:50%; background:#5F6E24; flex:none; }
    .dot.rec { background:#B0392B; animation:p 1.4s ease-in-out infinite; }
    .time { font-family:'JetBrains Mono',monospace; font-size:12px; color:#6B6E63; }
    @keyframes p { 0%,100%{opacity:1} 50%{opacity:.3} }
  `;
  shadow.appendChild(style);

  const pill = document.createElement("div");
  pill.className = "pill";
  pill.innerHTML = `<span class="dot"></span><span class="label">Record</span><span class="time"></span>`;
  pill.addEventListener("click", onClick);
  shadow.appendChild(pill);

  void render();
  pollTimer = window.setInterval(render, 1000);
}

async function getStatus(): Promise<PopupStatus | null> {
  try {
    return (await chrome.runtime.sendMessage({ type: "GET_STATUS" })) as PopupStatus;
  } catch {
    return null;
  }
}

async function onClick(): Promise<void> {
  const status = await getStatus();
  if (!status) return;

  if (!status.auth.signedIn) {
    window.open(status.settings.dashboardUrl, "_blank");
    return;
  }

  if (status.state === "recording") {
    await chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
  } else if (status.state === "idle" || status.state === "error") {
    await chrome.runtime.sendMessage({ type: "START_RECORDING" });
  }
  void render();
}

async function render(): Promise<void> {
  if (!shadow) return;
  const pill = shadow.querySelector<HTMLElement>(".pill");
  const dot = shadow.querySelector<HTMLElement>(".dot");
  const label = shadow.querySelector<HTMLElement>(".label");
  const time = shadow.querySelector<HTMLElement>(".time");
  if (!pill || !dot || !label || !time) return;

  const status = await getStatus();
  if (!status) return;

  const busy =
    status.state === "requesting" || status.state === "stopping" || status.state === "uploading";
  pill.dataset.disabled = String(busy);
  dot.className = status.state === "recording" ? "dot rec" : "dot";

  if (!status.auth.signedIn) {
    label.textContent = "Sign in to record";
    time.textContent = "";
  } else if (status.state === "recording" && status.session) {
    label.textContent = "Stop";
    time.textContent = formatDuration(
      Math.floor((Date.now() - status.session.startedAt) / 1000)
    );
  } else if (busy) {
    label.textContent =
      status.state === "uploading" ? "Uploading…" : status.state === "stopping" ? "Stopping…" : "Starting…";
    time.textContent = "";
  } else {
    label.textContent = "Record";
    time.textContent = "";
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

if (document.body) {
  mount();
} else {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
}

window.addEventListener("pagehide", () => {
  if (pollTimer) window.clearInterval(pollTimer);
});
