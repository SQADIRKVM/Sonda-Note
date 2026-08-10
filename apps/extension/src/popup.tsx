/**
 * Popup UI — Chrome extension popup.
 *
 * Designed to seamlessly match Sonda Note's warm paper design system:
 * - Warm cream canvas (#F6F2EA) & paper cards (#FFFDF8)
 * - 1px hairline rules (#E4E1D8)
 * - Solid dark inversion CTA button (#191A14)
 * - Georgia display wordmark ("Sonda.")
 */

import { useCallback, useEffect, useState } from "react";

import type { PopupRequest, PopupStatus } from "./lib/types";

const T = {
  canvas: "#F6F2EA",
  paper: "#FFFDF8",
  ink: "#191A14",
  ink2: "#4F5248",
  ink3: "#6B6E63",
  rule: "#E4E1D8",
  rule2: "#CFCBBF",
  olive: "#5F6E24",
  live: "#2F7D6A",
  rose: "#B0392B",
  mono: "'JetBrains Mono', ui-monospace, monospace",
  sans: "system-ui, -apple-system, sans-serif",
  display: 'Georgia, "Iowan Old Style", serif',
};

function send<T = unknown>(request: PopupRequest, timeoutMs = 4000): Promise<T> {
  return Promise.race([
    chrome.runtime.sendMessage(request) as Promise<T>,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("The extension did not respond")), timeoutMs)
    ),
  ]);
}

export default function Popup() {
  const [status, setStatus] = useState<PopupStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await send<PopupStatus>({ type: "GET_STATUS" }));
      setLoadFailed(false);
      setActionError(null);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (window.location.search.includes("grant_mic=1")) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
          setTimeout(() => window.close(), 800);
        })
        .catch((err) => {
          console.warn("[sondanote] Mic permission denied in tab:", err);
        });
    }
  }, []);

  useEffect(() => {
    if (status?.state !== "recording" || !status.session) {
      setElapsed(0);
      return;
    }
    const startedAt = status.session.startedAt;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status?.state, status?.session?.startedAt]);

  const openMicGrantTab = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?grant_mic=1") });
  };

  const start = async () => {
    setBusy(true);
    setActionError(null);

    if (status?.settings.includeMic) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.warn("[sondanote] Mic permission prompt dismissed/denied", err);
      }
    }

    try {
      const result = await send<{ error?: string }>({ type: "START_RECORDING" });
      if (result?.error) setActionError(result.error);
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const stop = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await send({ type: "STOP_RECORDING" });
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const openDashboard = () => {
    const url = status?.settings.dashboardUrl ?? "http://localhost:3000";
    chrome.tabs.create({ url });
  };

  const toggleMic = async () => {
    if (!status) return;
    const nextMicState = !status.settings.includeMic;
    await send({
      type: "UPDATE_SETTINGS",
      settings: { includeMic: nextMicState },
    });

    if (nextMicState) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.warn("[sondanote] Mic permission request in popup:", err);
      }
    }
    void refresh();
  };

  if (!status) {
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 400, color: T.ink }}>
            Sonda<span style={{ color: T.olive }}>.</span>
          </div>
        </div>
        <Divider />
        {loadFailed ? (
          <>
            <Note tone="error">
              The extension background worker isn&apos;t responding. Reload the extension at
              chrome://extensions, then reopen this popup.
            </Note>
            <Button onClick={() => void refresh()} variant="primary">
              Try again
            </Button>
          </>
        ) : (
          <div style={{ color: T.ink3, fontFamily: T.sans, fontSize: 12 }}>Loading…</div>
        )}
      </Shell>
    );
  }

  const recording = status.state === "recording";
  const transitioning =
    status.state === "requesting" || status.state === "stopping" || status.state === "uploading";
  const error = actionError ?? status.error;

  return (
    <Shell>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 400, color: T.ink }}>
          Sonda<span style={{ color: T.olive }}>.</span>
        </div>
        <StatusPill state={status.state} />
      </div>

      <Divider />

      {/* not signed in */}
      {!status.auth.signedIn && (
        <>
          <p style={{ fontSize: 12, color: T.ink2, lineHeight: 1.6, margin: "4px 0 12px" }}>
            Sign in on the Sonda Note dashboard to link this extension to your workspace.
          </p>
          <Button onClick={openDashboard} variant="primary">
            Open dashboard →
          </Button>
        </>
      )}

      {/* signed in */}
      {status.auth.signedIn && (
        <>
          <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink3, marginBottom: 12 }}>
            {status.auth.workspaceName || status.auth.email || "workspace linked"}
          </div>

          {recording && status.session && (
            <div
              style={{
                background: T.paper,
                border: `1px solid ${T.rule}`,
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: T.rose,
                    animation: "sondanotePulse 1.4s ease-in-out infinite",
                  }}
                />
                <span style={{ fontFamily: T.mono, fontSize: 16, color: T.ink, fontWeight: 600 }}>
                  {formatDuration(elapsed)}
                </span>
              </div>
              <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink2, lineHeight: 1.6 }}>
                {status.session.chunksSent} chunk{status.session.chunksSent === 1 ? "" : "s"} uploaded
                <br />
                mic {status.session.micIncluded ? "on" : "off"} · tab audio on
              </div>
            </div>
          )}

          {!recording && !transitioning && (
            <>
              {!status.onMeetTab && (
                <Note tone="warn">
                  Open Google Meet, Zoom Web, or Teams Web in a browser tab to record.
                </Note>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "2px 0 12px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    color: T.ink2,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={status.settings.includeMic}
                    onChange={toggleMic}
                    style={{ accentColor: T.olive, cursor: "pointer" }}
                  />
                  Include my microphone
                </label>
                {status.settings.includeMic && (
                  <button
                    onClick={openMicGrantTab}
                    style={{
                      background: "none",
                      border: "none",
                      color: T.olive,
                      fontSize: 11,
                      fontFamily: T.sans,
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    Grant mic 🎙️
                  </button>
                )}
              </div>
            </>
          )}

          {error && <Note tone="error">{error}</Note>}

          <div style={{ display: "flex", gap: 8 }}>
            {recording ? (
              <Button onClick={stop} disabled={busy} variant="stop">
                ■ Stop &amp; transcribe
              </Button>
            ) : (
              <Button
                onClick={start}
                disabled={busy || transitioning || !status.onMeetTab}
                variant="primary"
              >
                {transitioning ? labelFor(status.state) : "● Start recording"}
              </Button>
            )}
          </div>

          <Divider />
          <button
            onClick={openDashboard}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontFamily: T.sans,
              fontSize: 11,
              color: T.ink2,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            Open dashboard →
          </button>
        </>
      )}
    </Shell>
  );
}

function labelFor(state: PopupStatus["state"]): string {
  if (state === "requesting") return "Starting…";
  if (state === "stopping") return "Stopping…";
  if (state === "uploading") return "Uploading…";
  return "Working…";
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 310,
        minHeight: 180,
        background: T.canvas,
        color: T.ink,
        fontFamily: T.sans,
        padding: 18,
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @keyframes sondanotePulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
        * { box-sizing: border-box }
      `}</style>
      {children}
    </div>
  );
}

function StatusPill({ state }: { state: PopupStatus["state"] }) {
  const map: Record<PopupStatus["state"], { label: string; color: string; bg: string }> = {
    idle: { label: "READY", color: T.ink3, bg: T.paper },
    requesting: { label: "STARTING", color: T.olive, bg: "#E4E9D7" },
    recording: { label: "RECORDING", color: T.rose, bg: "#F1E4DF" },
    stopping: { label: "STOPPING", color: T.olive, bg: "#E4E9D7" },
    uploading: { label: "UPLOADING", color: T.olive, bg: "#E4E9D7" },
    error: { label: "ERROR", color: T.rose, bg: "#F1E4DF" },
  };
  const { label, color, bg } = map[state];
  return (
    <span
      style={{
        fontFamily: T.sans,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.04em",
        color,
        background: bg,
        border: `1px solid ${T.rule}`,
        borderRadius: 999,
        padding: "3px 9px",
      }}
    >
      {label}
    </span>
  );
}

function Divider() {
  return <div style={{ height: 1, background: T.rule, margin: "14px 0" }} />;
}

function Note({ tone, children }: { tone: "warn" | "error"; children: React.ReactNode }) {
  const color = tone === "error" ? T.rose : T.ink2;
  return (
    <div
      style={{
        fontSize: 11,
        lineHeight: 1.6,
        color,
        background: tone === "error" ? "#F1E4DF" : T.paper,
        border: `1px solid ${tone === "error" ? "rgba(176,57,43,0.3)" : T.rule}`,
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function Button({
  onClick,
  children,
  disabled,
  variant,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  variant: "primary" | "stop";
}) {
  const background = variant === "stop" ? T.paper : T.ink;
  const color = variant === "stop" ? T.rose : "#FBF9F4";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        background,
        color,
        border: variant === "stop" ? `1px solid ${T.rose}` : "none",
        borderRadius: 999,
        padding: "11px 16px",
        fontFamily: T.sans,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.01em",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "background 0.2s",
      }}
    >
      {children}
    </button>
  );
}
