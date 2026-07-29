/**
 * Content script on Google Meet — a floating record pill.
 *
 * Purpose is convenience only: the popup can do everything this does. It exists
 * because reaching for the toolbar mid-call is friction, and the moment a user
 * wants to record is the moment the call starts.
 *
 * All privileged work stays in the service worker; this script only sends
 * messages. It never touches audio.
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
  // Shadow DOM so Meet's stylesheet cannot restyle the pill and ours cannot
  // leak into Meet's UI.
  shadow = host.attachShadow({ mode: "closed" });
  document.body.appendChild(host);

  const style = document.createElement("style");
  style.textContent = `
    .pill {
      display:flex; align-items:center; gap:9px;
      background:#0C0C0A; border:1px solid #2E2E28; border-radius:999px;
      padding:9px 15px; cursor:pointer; user-select:none;
      font-family:'Space Grotesk',system-ui,sans-serif; font-size:12px; font-weight:600;
      color:#F0EFE6; box-shadow:0 6px 22px rgba(0,0,0,.45);
      transition:border-color .18s, transform .18s;
    }
    .pill:hover { border-color:#FF6B00; transform:translateY(-1px); }
    .pill[data-disabled="true"] { opacity:.5; cursor:default; transform:none; }
    .dot { width:8px; height:8px; border-radius:50%; background:#FF6B00; flex:none; }
    .dot.rec { background:#E17055; animation:p 1.4s ease-in-out infinite; }
    .time { font-family:'JetBrains Mono',monospace; font-size:11px; color:#8C8C78; }
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
    // Service worker asleep or extension reloaded — leave the last render up.
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

// Meet is a SPA: the pill must survive route changes into and out of a call.
if (document.body) {
  mount();
} else {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
}

window.addEventListener("pagehide", () => {
  if (pollTimer) window.clearInterval(pollTimer);
});
