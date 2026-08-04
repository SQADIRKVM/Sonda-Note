/**
 * Popup UI — the extension's only visible surface.
 *
 * Styling is inline rather than Tailwind: the popup is one small component and
 * inlining keeps the extension bundle free of a CSS build step. The design tokens
 * mirror the product spec's palette (saffron on near-black).
 */

import { useCallback, useEffect, useState } from "react";

import type { PopupRequest, PopupStatus } from "./lib/types";

const T = {
  ink: "#0C0C0A",
  ink2: "#141410",
  ink3: "#1C1C18",
  rule: "#2E2E28",
  rule2: "#3A3A32",
  smoke: "#5C5C50",
  ash: "#8C8C78",
  paper: "#D4D4C0",
  cream: "#F0EFE6",
  saffron: "#FF6B00",
  kerala: "#00B894",
  rose: "#E17055",
  mono: "'JetBrains Mono', ui-monospace, monospace",
  sans: "'Space Grotesk', system-ui, sans-serif",
};

/**
 * Send a message to the service worker, with a timeout.
 *
 * MV3 service workers are terminated when idle and can fail to respond if they
 * throw while waking. Without a timeout the popup would sit on "Loading…"
 * forever with nothing to explain why.
 */
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
      // Keep any status already on screen; only show the failure state when we
      // have nothing at all to render.
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Poll rather than subscribe: the service worker may be asleep, and a
    // 1s poll is cheap for a popup that is only open while the user looks at it.
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    // If opened with ?grant_mic=1 in a full tab, prompt for microphone permission
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

  // Elapsed timer — ticks every second while recording
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

    // Request microphone permission on user interaction so Chrome grants mic access to the extension
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
          <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, color: T.cream }}>
            Sonda Note
            <sup style={{ fontFamily: T.mono, fontSize: 7, color: T.saffron, marginLeft: 3 }}>
              MEET AI
            </sup>
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
          <div style={{ color: T.smoke, fontFamily: T.mono, fontSize: 11 }}>Loading…</div>
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
        <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, color: T.cream, letterSpacing: "-0.02em" }}>
          Sonda Note
          <sup style={{ fontFamily: T.mono, fontSize: 7, color: T.saffron, marginLeft: 3, letterSpacing: "0.08em" }}>
            MEET AI
          </sup>
        </div>
        <StatusPill state={status.state} />
      </div>

      <Divider />

      {/* not signed in */}
      {!status.auth.signedIn && (
        <>
          <p style={{ fontSize: 12, color: T.ash, lineHeight: 1.7, margin: "4px 0 12px" }}>
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
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.smoke, letterSpacing: "0.04em", marginBottom: 12 }}>
            {status.auth.workspaceName || status.auth.email || "workspace linked"}
          </div>

          {recording && status.session && (
            <div
              style={{
                background: T.ink3,
                border: `1px solid ${T.rule}`,
                borderRadius: 4,
                padding: "12px 14px",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: T.rose,
                    animation: "sondanotePulse 1.4s ease-in-out infinite",
                  }}
                />
                <span style={{ fontFamily: T.mono, fontSize: 16, color: T.cream, letterSpacing: "0.04em" }}>
                  {formatDuration(elapsed)}
                </span>
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.smoke, lineHeight: 1.7 }}>
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
                    fontSize: 11,
                    color: T.ash,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={status.settings.includeMic}
                    onChange={toggleMic}
                    style={{ accentColor: T.saffron, cursor: "pointer" }}
                  />
                  Include my microphone
                </label>
                {status.settings.includeMic && (
                  <button
                    onClick={openMicGrantTab}
                    style={{
                      background: "none",
                      border: "none",
                      color: T.saffron,
                      fontSize: 10,
                      fontFamily: T.mono,
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
              fontFamily: T.mono,
              fontSize: 10,
              color: T.smoke,
              letterSpacing: "0.06em",
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
        width: 300,
        minHeight: 180,
        background: T.ink,
        color: T.paper,
        fontFamily: T.sans,
        padding: 16,
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
  const map: Record<PopupStatus["state"], { label: string; color: string }> = {
    idle: { label: "READY", color: T.smoke },
    requesting: { label: "STARTING", color: T.saffron },
    recording: { label: "RECORDING", color: T.rose },
    stopping: { label: "STOPPING", color: T.saffron },
    uploading: { label: "UPLOADING", color: T.saffron },
    error: { label: "ERROR", color: T.rose },
  };
  const { label, color } = map[state];
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: 8,
        letterSpacing: "0.1em",
        color,
        border: `1px solid ${color}`,
        borderRadius: 2,
        padding: "3px 7px",
      }}
    >
      {label}
    </span>
  );
}

function Divider() {
  return <div style={{ height: 1, background: T.rule, margin: "12px 0" }} />;
}

function Note({ tone, children }: { tone: "warn" | "error"; children: React.ReactNode }) {
  const color = tone === "error" ? T.rose : T.ash;
  return (
    <div
      style={{
        fontSize: 11,
        lineHeight: 1.6,
        color,
        background: tone === "error" ? "rgba(225,112,85,0.07)" : T.ink2,
        border: `1px solid ${tone === "error" ? "rgba(225,112,85,0.22)" : T.rule}`,
        borderRadius: 3,
        padding: "9px 11px",
        marginBottom: 10,
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
  const background = variant === "stop" ? "transparent" : T.saffron;
  const color = variant === "stop" ? T.rose : "#000";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        background,
        color,
        border: variant === "stop" ? `1px solid ${T.rose}` : "none",
        borderRadius: 2,
        padding: "10px 14px",
        fontFamily: T.sans,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.02em",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}
