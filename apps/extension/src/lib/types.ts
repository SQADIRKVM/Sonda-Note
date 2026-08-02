/**
 * Shared types and the message contract between the extension's contexts.
 *
 * MV3 splits the extension across three isolated JS contexts:
 *   background.ts  — service worker: state, auth, orchestration. CANNOT touch media.
 *   offscreen.ts   — offscreen document: holds MediaRecorder and the WebSocket.
 *   popup / content — UI.
 *
 * They communicate only via chrome.runtime messages, so the payloads are typed here.
 */

export type RecordingState =
  | "idle"
  | "requesting" // waiting for the mic permission prompt / stream setup
  | "recording"
  | "stopping"
  | "uploading" // recording stopped, flushing the last chunks
  | "error";

export interface RecordingSession {
  meetingId: string;
  workspaceId: string | null;
  title: string;
  meetUrl: string | null;
  startedAt: number;
  chunksSent: number;
  micIncluded: boolean;
}

export interface StoredAuth {
  accessToken: string;
  refreshToken?: string;
  /** Unix seconds. Used to refuse a recording that would die mid-meeting. */
  expiresAt?: number;
  email?: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
}

export interface ExtensionSettings {
  apiBaseUrl: string;
  dashboardUrl: string;
  includeMic: boolean;
  /** Milliseconds per MediaRecorder chunk. 30s per spec layer 02. */
  chunkMs: number;
  autoSummarise: boolean;
  template: string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiBaseUrl: process.env.PLASMO_PUBLIC_API_URL || "http://localhost:8000",
  dashboardUrl: process.env.PLASMO_PUBLIC_DASHBOARD_URL || "http://localhost:3000",
  includeMic: true,
  chunkMs: 30_000,
  autoSummarise: true,
  template: "client_meeting",
};

/* ── background → offscreen ── */

export interface StartCaptureMessage {
  target: "offscreen";
  type: "START_CAPTURE";
  streamId: string;
  meetingId: string;
  workspaceId: string | null;
  token: string;
  apiBaseUrl: string;
  includeMic: boolean;
  chunkMs: number;
}

export interface StopCaptureMessage {
  target: "offscreen";
  type: "STOP_CAPTURE";
}

export type OffscreenMessage = StartCaptureMessage | StopCaptureMessage;

/* ── offscreen → background ── */

export interface CaptureStartedEvent {
  target: "background";
  type: "CAPTURE_STARTED";
  micIncluded: boolean;
}

export interface ChunkSentEvent {
  target: "background";
  type: "CHUNK_SENT";
  seq: number;
  bytes: number;
}

export interface CaptureStoppedEvent {
  target: "background";
  type: "CAPTURE_STOPPED";
  chunksSent: number;
}

export interface CaptureErrorEvent {
  target: "background";
  type: "CAPTURE_ERROR";
  message: string;
}

export type BackgroundEvent =
  | CaptureStartedEvent
  | ChunkSentEvent
  | CaptureStoppedEvent
  | CaptureErrorEvent;

/* ── popup ↔ background ── */

export interface PopupStatus {
  state: RecordingState;
  session: RecordingSession | null;
  auth: { signedIn: boolean; email?: string; workspaceName?: string | null };
  settings: ExtensionSettings;
  error?: string;
  /** Whether the active tab is a Google Meet call (tabCapture only works there). */
  onMeetTab: boolean;
}

export type PopupRequest =
  | { type: "GET_STATUS" }
  | { type: "START_RECORDING"; title?: string }
  | { type: "STOP_RECORDING" }
  | { type: "SYNC_AUTH" }
  | { type: "UPDATE_SETTINGS"; settings: Partial<ExtensionSettings> };
