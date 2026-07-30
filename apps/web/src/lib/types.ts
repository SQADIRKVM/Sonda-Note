export type MeetingStatus = "uploading" | "queued" | "processing" | "ready" | "failed";

export interface Meeting {
  id: string;
  workspace_id: string;
  title: string;
  status: MeetingStatus;
  platform: string;
  meet_url: string | null;
  error_message: string | null;
  duration_secs: number | null;
  language: string | null;
  speaker_count: number | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface TranscriptSegment {
  id: string;
  seq: number;
  speaker: string;
  start_secs: number;
  end_secs: number;
  text: string;
  raw_text: string;
  language: string | null;
  edited_at: string | null;
}

export interface MeetingSummary {
  id: string;
  template: string;
  overview: string | null;
  sections: Record<string, string | string[]>;
  model: string;
  created_at: string;
}

export interface ActionItem {
  id: string;
  meeting_id: string;
  text: string;
  owner: string | null;
  due_hint: string | null;
  status: "open" | "done";
  created_at: string;
  meetings?: { id: string; title: string; created_at: string } | null;
}

export interface Insight {
  id: string;
  kind: "decision" | "risk" | "question" | "blocker";
  text: string;
}

export interface VocabularyTerm {
  id: string;
  wrong: string;
  right_term: string;
  source: string;
  hit_count: number;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  industry: string;
  role?: string;
}

export interface TemplateSection {
  key: string;
  label: string;
  kind: "list" | "text";
}

export interface MeetingTemplate {
  id: string;
  name: string;
  description: string;
  available: boolean;
  sections: TemplateSection[];
}

export const STATUS_LABELS: Record<MeetingStatus, string> = {
  uploading: "Recording",
  queued: "Queued",
  processing: "Transcribing",
  ready: "Ready",
  failed: "Failed",
};

export function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function formatTimestamp(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Language codes Whisper returns, mapped to names a Kerala user recognises. */
export const LANGUAGE_NAMES: Record<string, string> = {
  ml: "Malayalam",
  en: "English",
  ta: "Tamil",
  te: "Telugu",
  hi: "Hindi",
  kn: "Kannada",
  unknown: "Unknown",
};

export function languageName(code: string | null): string {
  if (!code) return "—";
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}
