/**
 * Service worker — orchestration only.
 *
 * MV3 constraints that shape this file:
 *   · No DOM, no media APIs. All capture happens in the offscreen document.
 *   · Terminated after ~30s idle. All state lives in chrome.storage.local, never
 *     in module scope, or a long meeting loses its session.
 *   · chrome.tabCapture.getMediaStreamId() must be called HERE (it needs the tab
 *     context), then the id is handed to the offscreen document.
 */

import { createMeeting, deleteMeeting, finaliseMeeting } from "./lib/api";
import {
  clearAuth,
  getAuth,
  getSession,
  getSettings,
  getState,
  isTokenUsable,
  setAuth,
  setSession,
  setState,
  updateSettings,
} from "./lib/storage";
import type {
  BackgroundEvent,
  PopupRequest,
  PopupStatus,
  RecordingSession,
  StoredAuth,
} from "./lib/types";

const OFFSCREEN_PATH = "offscreen.html";
let lastError: string | undefined;

/* ─────────────────────────────────────────────────────────
   OFFSCREEN LIFECYCLE
───────────────────────────────────────────────────────── */

async function hasOffscreenDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  return contexts.length > 0;
}

async function ensureOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    // USER_MEDIA is what permits getUserMedia; AUDIO_PLAYBACK is required
    // because we re-route tab audio back to the speakers.
    reasons: [
      chrome.offscreen.Reason.USER_MEDIA,
      chrome.offscreen.Reason.AUDIO_PLAYBACK,
    ],
    justification: "Recording and mixing meeting audio for transcription",
  });
}

async function closeOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
  }
}

/**
 * Promise wrapper for chrome.tabCapture.getMediaStreamId, which the current
 * @types/chrome declares as callback-only.
 */
function getMediaStreamId(targetTabId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId }, (streamId) => {
      const error = chrome.runtime.lastError;
      if (error || !streamId) {
        reject(new Error(error?.message ?? "Could not capture this tab"));
        return;
      }
      resolve(streamId);
    });
  });
}

function isMeetingUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes("meet.google.com") ||
    url.includes("zoom.us") ||
    url.includes("teams.microsoft.com") ||
    url.includes("teams.live.com")
  );
}

function detectPlatform(url?: string): string {
  if (!url) return "google_meet";
  if (url.includes("zoom.us")) return "zoom";
  if (url.includes("teams")) return "teams";
  return "google_meet";
}

/* ─────────────────────────────────────────────────────────
   RECORDING
───────────────────────────────────────────────────────── */

async function startRecording(customTitle?: string): Promise<void> {
  lastError = undefined;

  const state = await getState();
  if (state === "recording" || state === "requesting") {
    throw new Error("Already recording");
  }

  const auth = await getAuth();
  if (!isTokenUsable(auth)) {
    throw new Error("Sign in on the Sonda Note dashboard first");
  }

  // Find active meeting tab (Google Meet, Zoom Web, or Teams Web)
  const meetTabs = await chrome.tabs.query({
    url: [
      "https://meet.google.com/*",
      "https://*.zoom.us/*",
      "https://teams.microsoft.com/*",
      "https://teams.live.com/*",
    ],
  });
  let tab = meetTabs.find((t) => t.active) || meetTabs[0];
  if (!tab) {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    tab = activeTab;
  }

  if (!tab?.id || !isMeetingUrl(tab.url)) {
    throw new Error("Open a Google Meet, Zoom Web, or Teams Web call first");
  }

  await setState("requesting");

  let meetingIdToDelete: string | null = null;
  let meetingWorkspaceId: string | null = null;

  try {
    const settings = await getSettings();

    const meeting = await createMeeting(
      settings.apiBaseUrl,
      auth!.accessToken,
      auth!.workspaceId ?? null,
      {
        title: customTitle?.trim() || deriveTitle(tab.title),
        meet_url: tab.url,
        platform: detectPlatform(tab.url),
      }
    );
    meetingIdToDelete = meeting.id;
    meetingWorkspaceId = meeting.workspace_id;

    const streamId = await getMediaStreamId(tab.id);

    await ensureOffscreenDocument();

    const session: RecordingSession = {
      meetingId: meeting.id,
      workspaceId: meeting.workspace_id,
      title: meeting.title,
      meetUrl: tab.url ?? null,
      startedAt: Date.now(),
      chunksSent: 0,
      micIncluded: settings.includeMic,
    };
    await setSession(session);

    await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "START_CAPTURE",
      streamId,
      meetingId: meeting.id,
      workspaceId: meeting.workspace_id,
      token: auth!.accessToken,
      apiBaseUrl: settings.apiBaseUrl,
      includeMic: settings.includeMic,
      chunkMs: settings.chunkMs,
    });
  } catch (error) {
    await setState("error");
    lastError = error instanceof Error ? error.message : String(error);
    if (meetingIdToDelete) {
      const settings = await getSettings();
      void deleteMeeting(settings.apiBaseUrl, auth!.accessToken, meetingWorkspaceId, meetingIdToDelete);
    }
    await setSession(null);
    await closeOffscreenDocument();
    throw error;
  }
}

async function stopRecording(): Promise<void> {
  const state = await getState();
  if (state !== "recording" && state !== "requesting") return;

  await setState("stopping");
  try {
    await chrome.runtime.sendMessage({ target: "offscreen", type: "STOP_CAPTURE" });
  } catch {
    // Offscreen document already gone — finalise anyway so the meeting is not
    // stuck in 'uploading' forever.
    await handleCaptureStopped(0);
  }
}

async function handleCaptureStopped(chunksSent: number): Promise<void> {
  await setState("uploading");
  const session = await getSession();
  const auth = await getAuth();
  const settings = await getSettings();

  if (session && auth) {
    try {
      await finaliseMeeting(
        settings.apiBaseUrl,
        auth.accessToken,
        session.workspaceId,
        session.meetingId,
        {
          title: session.title,
          duration_secs: Math.round((Date.now() - session.startedAt) / 1000),
          auto_summarise: settings.autoSummarise,
          template: settings.template,
        }
      );

      notify(
        "Recording finished",
        chunksSent > 0
          ? "Transcribing now — open the dashboard to follow along."
          : "No audio was captured. Check that the Meet tab had sound."
      );
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      notify("Upload problem", lastError);
    }
  }

  await closeOffscreenDocument();
  await setSession(null);
  await setState(lastError ? "error" : "idle");
}

function deriveTitle(tabTitle?: string): string {
  if (!tabTitle) return "Google Meet call";
  // Meet tab titles look like "Meet — abc-defg-hij" or "Weekly sync - Google Meet".
  const cleaned = tabTitle.replace(/\s*[-—|]\s*Google Meet\s*$/i, "").trim();
  const date = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
  return cleaned && !/^meet$/i.test(cleaned) ? `${cleaned} · ${date}` : `Meet call · ${date}`;
}

function notify(title: string, message: string): void {
  // The notifications permission may be absent, and create() surfaces failures
  // via lastError rather than throwing — so read it to avoid an unchecked-error
  // warning in the console.
  try {
    chrome.notifications?.create(
      {
        type: "basic",
        iconUrl: "assets/icon128.png",
        title: `Sonda Note · ${title}`,
        message,
      },
      () => void chrome.runtime.lastError
    );
  } catch {
    // Notifications unavailable — the popup still shows the state.
  }
}

/* ─────────────────────────────────────────────────────────
   MESSAGE ROUTING
───────────────────────────────────────────────────────── */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Events from the offscreen document.
  if (message?.target === "background") {
    void handleOffscreenEvent(message as BackgroundEvent);
    return false;
  }

  // Requests from the popup. Returning true keeps the channel open for the
  // async response.
  void handlePopupRequest(message as PopupRequest)
    .then(sendResponse)
    .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
  return true;
});

async function handleOffscreenEvent(event: BackgroundEvent): Promise<void> {
  switch (event.type) {
    case "CAPTURE_STARTED": {
      await setState("recording");
      const session = await getSession();
      if (session) {
        await setSession({ ...session, micIncluded: event.micIncluded });
      }
      chrome.action.setBadgeText({ text: "REC" });
      chrome.action.setBadgeBackgroundColor({ color: "#FF6B00" });
      break;
    }
    case "CHUNK_SENT": {
      const session = await getSession();
      if (session) {
        await setSession({ ...session, chunksSent: session.chunksSent + 1 });
      }
      break;
    }
    case "CAPTURE_STOPPED": {
      chrome.action.setBadgeText({ text: "" });
      await handleCaptureStopped(event.chunksSent);
      break;
    }
    case "CAPTURE_ERROR": {
      lastError = event.message;
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#E17055" });
      await setState("error");
      await closeOffscreenDocument();
      notify("Recording failed", event.message);
      break;
    }
  }
}

async function handlePopupRequest(request: PopupRequest): Promise<unknown> {
  switch (request.type) {
    case "GET_STATUS": {
      // Try to adopt a session from an open dashboard tab, but NEVER block the
      // status response on it. The popup polls this every second, and awaiting a
      // script injection here would leave the UI stuck on "Loading…" whenever
      // that call is slow or the target tab is unresponsive.
      void pullAuthFromDashboard().catch(() => {});

      const [state, session, auth, settings] = await Promise.all([
        getState(),
        getSession(),
        getAuth(),
        getSettings(),
      ]);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const status: PopupStatus = {
        state,
        session,
        auth: {
          signedIn: isTokenUsable(auth),
          email: auth?.email,
          workspaceName: auth?.workspaceName,
        },
        settings,
        error: lastError,
        onMeetTab: isMeetingUrl(tab?.url),
      };
      return status;
    }

    case "START_RECORDING":
      await startRecording(request.title);
      return { ok: true };

    case "STOP_RECORDING":
      await stopRecording();
      return { ok: true };

    case "UPDATE_SETTINGS":
      return { settings: await updateSettings(request.settings) };

    case "SYNC_AUTH":
      return { signedIn: await pullAuthFromDashboard() };

    default:
      return { error: "Unknown request" };
  }
}

/**
 * Pull the session out of an already-open dashboard tab.
 *
 * The dashboard pushes its token to us on load, but that misses the common case
 * where the user signed in *before* installing the extension — the push already
 * happened and will not repeat until they reload. Rather than making the user
 * figure that out, we read the session directly from the dashboard tab's
 * localStorage, which we can do because the dashboard origin is in
 * host_permissions.
 *
 * Returns true if we now hold a usable token.
 */
let lastPullAttempt = 0;

async function pullAuthFromDashboard(): Promise<boolean> {
  if (isTokenUsable(await getAuth())) return true;

  // The popup polls GET_STATUS once a second. Injecting a script into every
  // dashboard tab that often is wasteful, so only retry every few seconds.
  const now = Date.now();
  if (now - lastPullAttempt < 3000) return false;
  lastPullAttempt = now;

  const settings = await getSettings();
  let origin: string;
  try {
    origin = new URL(settings.dashboardUrl).origin;
  } catch {
    return false;
  }

  const tabs = await chrome.tabs.query({ url: `${origin}/*` });
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      // Race against a timeout: a tab that is mid-navigation or blocked can
      // leave executeScript pending indefinitely.
      const injection = chrome.scripting.executeScript({
        target: { tabId: tab.id },
        // Runs in the page's world, so it sees the dashboard's localStorage.
        func: () => window.localStorage.getItem("sondanote.session"),
      });
      const results = await Promise.race([
        injection,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
      if (!results) continue;

      const [result] = results;
      const raw = result?.result as string | null | undefined;
      if (!raw) continue;

      const session = JSON.parse(raw) as {
        access_token?: string;
        expires_at?: number;
        user?: { email?: string };
        workspace?: { id?: string; name?: string };
      };
      if (!session.access_token) continue;

      const auth: StoredAuth = {
        accessToken: session.access_token,
        expiresAt: session.expires_at,
        email: session.user?.email,
        workspaceId: session.workspace?.id ?? null,
        workspaceName: session.workspace?.name ?? null,
      };
      if (!isTokenUsable(auth)) continue;

      await setAuth(auth);
      return true;
    } catch {
      // Tab closed mid-query, or scripting blocked on that page — try the next.
    }
  }

  return false;
}

/* ─────────────────────────────────────────────────────────
   AUTH BRIDGE — dashboard → extension
───────────────────────────────────────────────────────── */

/**
 * The dashboard pushes the Supabase session here after sign-in (spec auth flow
 * step 2). Only pages listed in externally_connectable may call this.
 */
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const origin = sender.origin ?? sender.url ?? "";
  void (async () => {
    const settings = await getSettings();

    // Chrome already filtered by externally_connectable before we got here; this
    // is the second gate. Localhost ports vary between dev setups, so any
    // loopback origin is accepted in development — the manifest still decides
    // which ones can reach us at all.
    const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
      origin.replace(/\/$/, "")
    );
    const allowed = origin.startsWith(settings.dashboardUrl) || isLoopback;

    if (!allowed) {
      sendResponse({ ok: false, error: "Origin not allowed" });
      return;
    }

    if (message?.type === "SONDANOTE_SET_AUTH" && message.accessToken) {
      const auth: StoredAuth = {
        accessToken: message.accessToken,
        refreshToken: message.refreshToken,
        expiresAt: message.expiresAt,
        email: message.email,
        workspaceId: message.workspaceId ?? null,
        workspaceName: message.workspaceName ?? null,
      };
      await setAuth(auth);
      sendResponse({ ok: true });
    } else if (message?.type === "SONDANOTE_SIGN_OUT") {
      await clearAuth();
      sendResponse({ ok: true });
    } else if (message?.type === "SONDANOTE_PING") {
      sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    } else {
      sendResponse({ ok: false, error: "Unknown message" });
    }
  })();
  return true;
});

/* ─────────────────────────────────────────────────────────
   RECOVERY
───────────────────────────────────────────────────────── */

// If the service worker restarts while state says "recording" but the offscreen
// document is gone, the recording is unrecoverable — reset so the UI is honest
// rather than showing a phantom REC badge.
chrome.runtime.onStartup.addListener(() => void reconcileState());
chrome.runtime.onInstalled.addListener(() => void reconcileState());

async function reconcileState(): Promise<void> {
  const state = await getState();
  if (state === "recording" || state === "requesting" || state === "stopping") {
    if (!(await hasOffscreenDocument())) {
      lastError = "Recording was interrupted by a browser restart";
      await setState("error");
      await setSession(null);
      chrome.action.setBadgeText({ text: "" });
    }
  }
}
