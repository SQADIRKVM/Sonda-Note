"use client";

/**
 * Client for the FastAPI backend.
 *
 * All dashboard data comes through here. The previous version read most tables
 * straight from Supabase and used the API only for compute; with the local
 * backend there is no client-side database, so the API is the single source.
 */

import { apiBase, authHeaders, AuthError, getSession } from "./auth";
import type {
  ActionItem,
  Insight,
  Meeting,
  MeetingSummary,
  MeetingTemplate,
  TranscriptSegment,
  VocabularyTerm,
  Workspace,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: { ...authHeaders(), ...init.headers },
    });
  } catch (error) {
    if (error instanceof AuthError) throw new ApiError(error.message, 401);
    throw new ApiError(`Cannot reach the Sonda Note API at ${apiBase()}`, 0);
  }

  if (response.status === 401) {
    throw new ApiError("Your session expired — sign in again", 401);
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(detail, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

/* ── overview / meetings ── */

export interface OverviewResponse {
  workspace: Workspace;
  meetings: Meeting[];
  stats: {
    meetings: number;
    minutes: number;
    open_tasks: number;
    vocabulary_terms: number;
  };
}

export function fetchOverview() {
  return call<OverviewResponse>("/api/overview");
}

export function fetchMeetings() {
  return call<{ meetings: Meeting[] }>("/api/meetings");
}

export interface MeetingDetailResponse {
  meeting: Meeting;
  segments: TranscriptSegment[];
  summaries: MeetingSummary[];
  tasks: ActionItem[];
  insights: Insight[];
}

export function fetchMeetingDetail(meetingId: string) {
  return call<MeetingDetailResponse>(`/api/meetings/${meetingId}/detail`);
}

export function reprocessMeeting(meetingId: string) {
  return call<{ status: string }>(`/api/meetings/${meetingId}/process`, { method: "POST" });
}

export function deleteMeeting(meetingId: string) {
  return call<{ deleted: string }>(`/api/meetings/${meetingId}`, { method: "DELETE" });
}

/* ── intelligence ── */

export interface SummaryPayload {
  template: string;
  overview: string;
  sections: Record<string, string | string[]>;
  action_items: { text: string; owner: string | null; due_hint: string | null }[];
  insights: { kind: string; text: string }[];
  model: string;
}

export function generateSummary(meetingId: string, template: string) {
  return call<SummaryPayload>(`/api/meetings/${meetingId}/summary`, {
    method: "POST",
    body: JSON.stringify({ template }),
  });
}

export function fetchTasks(status?: "open" | "done") {
  const query = status ? `?status=${status}` : "";
  return call<{ tasks: ActionItem[] }>(`/api/tasks${query}`);
}

export function setTaskStatus(taskId: string, status: "open" | "done") {
  return call<{ task: ActionItem }>(`/api/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/* ── transcript corrections (feeds the moat) ── */

export function correctSegment(segmentId: string, text: string, learnVocabulary = true) {
  return call<{ segment: TranscriptSegment }>(`/api/segments/${segmentId}`, {
    method: "PATCH",
    body: JSON.stringify({ text, learn_vocabulary: learnVocabulary }),
  });
}

/* ── vocabulary ── */

export function fetchVocabulary() {
  return call<{ terms: VocabularyTerm[]; industry: string }>("/api/vocabulary");
}

export function addVocabularyTerm(wrong: string, right: string) {
  return call<{ term: VocabularyTerm }>("/api/vocabulary", {
    method: "POST",
    body: JSON.stringify({ wrong, right }),
  });
}

export function deleteVocabularyTerm(termId: string) {
  return call<{ deleted: string }>(`/api/vocabulary/${termId}`, { method: "DELETE" });
}

/* ── templates ── */

export function fetchTemplates() {
  return call<{ templates: MeetingTemplate[]; default: string }>("/api/templates");
}

export async function checkApiHealth(): Promise<{
  ok: boolean;
  backend?: string;
  asr?: string;
  llm?: string;
  ffmpeg?: boolean;
}> {
  try {
    const response = await fetch(`${apiBase()}/health`);
    if (!response.ok) return { ok: false };
    const body = await response.json();
    return {
      ok: true,
      backend: body.backend,
      asr: body.asr_provider,
      llm: body.llm_provider,
      ffmpeg: body.ffmpeg,
    };
  } catch {
    return { ok: false };
  }
}

export { apiBase, getSession };
