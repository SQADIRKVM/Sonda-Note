/**
 * chrome.storage.local wrappers for auth and settings.
 *
 * Per the spec's auth flow, the JWT arrives here from the dashboard (the web app
 * writes it via chrome.runtime.sendMessage on sign-in) and is attached to every
 * upload. chrome.storage.local is extension-origin scoped — not readable by web
 * pages — but it is NOT encrypted, so we keep only the access token and never
 * anything longer-lived than a refresh token.
 */

import {
  DEFAULT_SETTINGS,
  type ExtensionSettings,
  type RecordingSession,
  type RecordingState,
  type StoredAuth,
} from "./types";

const AUTH_KEY = "sondanote.auth";
const SETTINGS_KEY = "sondanote.settings";
const SESSION_KEY = "sondanote.session";
const STATE_KEY = "sondanote.state";

export async function getAuth(): Promise<StoredAuth | null> {
  const result = await chrome.storage.local.get(AUTH_KEY);
  return (result[AUTH_KEY] as StoredAuth) ?? null;
}

export async function setAuth(auth: StoredAuth): Promise<void> {
  await chrome.storage.local.set({ [AUTH_KEY]: auth });
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove(AUTH_KEY);
}

/**
 * A token that expires mid-meeting means every subsequent chunk upload 401s and
 * the recording is lost. Refuse to start unless it survives the next 10 minutes.
 */
export function isTokenUsable(auth: StoredAuth | null, minSecondsLeft = 600): boolean {
  if (!auth?.accessToken) return false;
  if (!auth.expiresAt) return true; // unknown expiry — let the server decide
  return auth.expiresAt - Date.now() / 1000 > minSecondsLeft;
}

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...((result[SETTINGS_KEY] as Partial<ExtensionSettings>) ?? {}) };
}

export async function updateSettings(
  patch: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

/**
 * The session and state live in storage rather than a service-worker variable
 * because MV3 terminates an idle service worker after ~30 seconds and any
 * in-memory state would vanish mid-recording.
 */
export async function getSession(): Promise<RecordingSession | null> {
  const result = await chrome.storage.local.get(SESSION_KEY);
  return (result[SESSION_KEY] as RecordingSession) ?? null;
}

export async function setSession(session: RecordingSession | null): Promise<void> {
  if (session === null) {
    await chrome.storage.local.remove(SESSION_KEY);
  } else {
    await chrome.storage.local.set({ [SESSION_KEY]: session });
  }
}

export async function getState(): Promise<RecordingState> {
  const result = await chrome.storage.local.get(STATE_KEY);
  return (result[STATE_KEY] as RecordingState) ?? "idle";
}

export async function setState(state: RecordingState): Promise<void> {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}
