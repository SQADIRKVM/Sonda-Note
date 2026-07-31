/**
 * Offscreen document — pipeline layers 01–03.
 *
 * Why this file exists: in Manifest V3 the service worker has no DOM and no
 * access to media APIs, so `chrome.tabCapture` output cannot be recorded there.
 * An offscreen document is the only MV3 context that can hold a MediaRecorder,
 * and it survives service-worker termination — which matters because a
 * 47-minute meeting far outlives an idle service worker.
 *
 * What happens here:
 *   1. Turn the background's streamId into a tab MediaStream (getUserMedia with
 *      the chromeMediaSource constraint — NOT chrome.tabCapture.capture, which
 *      is unavailable outside a tab context in MV3).
 *   2. Capture the mic separately via getUserMedia.
 *   3. Merge both into one stream with Web Audio API.
 *   4. Re-route tab audio to the speakers, or the user goes deaf mid-call.
 *   5. MediaRecorder emits a 30s WebM chunk; ship it over the WebSocket.
 */

import type { BackgroundEvent, OffscreenMessage, StartCaptureMessage } from "./lib/types";

let recorder: MediaRecorder | null = null;
let audioContext: AudioContext | null = null;
let tabStream: MediaStream | null = null;
let micStream: MediaStream | null = null;
let socket: WebSocket | null = null;
let seq = 0;
let chunksSent = 0;

/** Chunks recorded before the socket was open, retried once it is. */
const pendingChunks: Blob[] = [];
let socketReady = false;
let closingIntentionally = false;

chrome.runtime.onMessage.addListener((message: OffscreenMessage) => {
  if (message?.target !== "offscreen") return;

  if (message.type === "START_CAPTURE") {
    void startCapture(message);
  } else if (message.type === "STOP_CAPTURE") {
    void stopCapture();
  }
});

function emit(event: BackgroundEvent): void {
  // The service worker may be asleep; a failed send is not fatal because the
  // background re-reads state from chrome.storage.local when it wakes.
  chrome.runtime.sendMessage(event).catch(() => {});
}

async function startCapture(message: StartCaptureMessage): Promise<void> {
  if (recorder) {
    emit({ target: "background", type: "CAPTURE_ERROR", message: "Already recording" });
    return;
  }

  seq = 0;
  chunksSent = 0;
  pendingChunks.length = 0;
  socketReady = false;
  closingIntentionally = false;

  try {
    // ── 1. tab audio (all remote participants, even while your mic is muted) ──
    tabStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // @ts-expect-error — Chrome-only constraints, absent from lib.dom.
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: message.streamId,
        },
      },
      video: false,
    });

    // ── 2. microphone (the local speaker) ──
    let micIncluded = false;
    if (message.includeMic) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        micIncluded = true;
      } catch (error) {
        // A denied mic still leaves a usable recording of everyone else, so
        // continue rather than aborting the meeting.
        console.warn("[sondanote] mic unavailable, continuing with tab audio only", error);
      }
    }

    // ── 3. merge via Web Audio API ──
    audioContext = new AudioContext();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    const destination = audioContext.createMediaStreamDestination();

    const tabSource = audioContext.createMediaStreamSource(tabStream);
    tabSource.connect(destination);

    // CRITICAL: tabCapture silences the tab's own playback. Without this the
    // user cannot hear the meeting they are recording.
    tabSource.connect(audioContext.destination);

    if (micStream) {
      const micSource = audioContext.createMediaStreamSource(micStream);
      // Halve both inputs so a loud mic cannot clip the mixed signal; Whisper
      // loses accuracy on clipped audio.
      const micGain = audioContext.createGain();
      micGain.gain.value = 0.85;
      micSource.connect(micGain);
      micGain.connect(destination);
      // Deliberately NOT connected to audioContext.destination — that would
      // play the user's own voice back at them.
    }

    // ── 4. open the transport before recording so chunk 0 is not orphaned ──
    await openSocket(message);

    // ── 5. record ──
    // Opus in WebM: what MediaRecorder supports natively, and ffmpeg converts it
    // to 16kHz mono WAV server-side (layer 04). Never convert in the browser.
    const mimeType = pickMimeType();
    recorder = new MediaRecorder(destination.stream, {
      mimeType,
      audioBitsPerSecond: 64_000, // speech, not music — 64kbps is ample
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) void sendChunk(event.data);
    };

    recorder.onerror = (event) => {
      const detail = (event as unknown as { error?: DOMException }).error;
      emit({
        target: "background",
        type: "CAPTURE_ERROR",
        message: `Recorder error: ${detail?.message ?? "unknown"}`,
      });
      void stopCapture();
    };

    // A stopped tab (user closes the Meet tab) ends the track; treat that as
    // "meeting over" and flush what we have.
    tabStream.getAudioTracks()[0]?.addEventListener("ended", () => {
      console.info("[sondanote] tab audio track ended — stopping");
      void stopCapture();
    });

    recorder.start(message.chunkMs);
    emit({ target: "background", type: "CAPTURE_STARTED", micIncluded });
  } catch (error) {
    await teardown();
    emit({
      target: "background",
      type: "CAPTURE_ERROR",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm"];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "audio/webm";
}

function openSocket(message: StartCaptureMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    const wsUrl =
      message.apiBaseUrl.replace(/^http/, "ws").replace(/\/$/, "") +
      `/ws/record/${message.meetingId}`;

    socket = new WebSocket(wsUrl);
    socket.binaryType = "arraybuffer";

    const timeout = setTimeout(() => {
      reject(new Error("Could not reach the Sonda Note server — is it running?"));
      socket?.close();
    }, 15_000);

    socket.onopen = () => {
      // Browsers cannot set headers on a WebSocket, so the JWT goes in the
      // first frame (spec auth flow step 3).
      socket?.send(
        JSON.stringify({
          type: "auth",
          token: message.token,
          workspace_id: message.workspaceId,
        })
      );
    };

    socket.onmessage = (event) => {
      let payload: { type?: string; detail?: string; seq?: number };
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (payload.type === "ready") {
        clearTimeout(timeout);
        socketReady = true;
        void flushPending();
        resolve();
      } else if (payload.type === "ack") {
        chunksSent += 1;
        emit({
          target: "background",
          type: "CHUNK_SENT",
          seq: payload.seq ?? 0,
          bytes: 0,
        });
      } else if (payload.type === "error") {
        console.error("[sondanote] server rejected a chunk:", payload.detail);
      }
    };

    socket.onerror = () => {
      clearTimeout(timeout);
      if (!socketReady) reject(new Error("WebSocket connection failed"));
    };

    socket.onclose = (event) => {
      clearTimeout(timeout);
      socketReady = false;
      if (!closingIntentionally && recorder) {
        emit({
          target: "background",
          type: "CAPTURE_ERROR",
          message:
            event.code === 4403 || event.code === 4401
              ? "Sign in again on the dashboard — your session expired"
              : `Connection lost (${event.code}). Recording stopped.`,
        });
        void stopCapture();
      }
    };
  });
}

async function sendChunk(blob: Blob): Promise<void> {
  if (!socketReady || socket?.readyState !== WebSocket.OPEN) {
    // Buffer rather than drop: a brief network blip should not punch a hole in
    // the transcript.
    pendingChunks.push(blob);
    return;
  }

  const current = seq++;
  try {
    socket.send(JSON.stringify({ type: "chunk", seq: current }));
    socket.send(await blob.arrayBuffer());
  } catch (error) {
    console.error("[sondanote] chunk send failed, buffering", error);
    seq = current; // reuse this sequence number on retry
    pendingChunks.push(blob);
  }
}

async function flushPending(): Promise<void> {
  while (pendingChunks.length > 0 && socketReady && socket?.readyState === WebSocket.OPEN) {
    const blob = pendingChunks.shift();
    if (blob) await sendChunk(blob);
  }
}

async function stopCapture(): Promise<void> {
  const recorderRef = recorder;
  recorder = null;

  if (recorderRef && recorderRef.state !== "inactive") {
    // requestData() forces out the partial chunk recorded since the last
    // timeslice, so the final seconds of the meeting are not lost.
    await new Promise<void>((resolve) => {
      recorderRef.addEventListener("stop", () => resolve(), { once: true });
      try {
        recorderRef.requestData();
        recorderRef.stop();
      } catch {
        resolve();
      }
    });
  }

  await flushPending();

  closingIntentionally = true;
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "done" }));
    // Give the server a moment to queue the pipeline before the socket drops.
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await teardown();
  emit({ target: "background", type: "CAPTURE_STOPPED", chunksSent });
}

async function teardown(): Promise<void> {
  tabStream?.getTracks().forEach((track) => track.stop());
  micStream?.getTracks().forEach((track) => track.stop());
  tabStream = null;
  micStream = null;

  if (audioContext && audioContext.state !== "closed") {
    await audioContext.close();
  }
  audioContext = null;

  socket?.close();
  socket = null;
  socketReady = false;
}
