"use client";

import { clsx } from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Check, Trash2, RotateCw, Download, FileText, Sparkles, AlertCircle } from "lucide-react";

import {
  ApiError,
  deleteMeeting,
  generateSummary,
  reprocessMeeting,
  setTaskStatus,
  type SummaryPayload,
} from "@/lib/api";
import {
  formatDuration,
  formatTimestamp,
  languageName,
  type ActionItem,
  type Insight,
  type Meeting,
  type MeetingSummary,
  type TranscriptSegment,
} from "@/lib/types";

import { TranscriptView } from "./transcript-view";
import { Button, Card, Spinner, StatusBadge, Toast, EmptyState } from "./ui";

const TEMPLATES = [
  { id: "client_meeting", name: "Client Meeting" },
  { id: "internal_standup", name: "Internal Standup" },
  { id: "discovery_call", name: "Discovery Call" },
  { id: "sales_call", name: "Sales Call" },
  { id: "project_review", name: "Project Review" },
];

function sectionLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

type Tab = "summary" | "transcript" | "tasks";

export function MeetingDetail({
  meeting: initialMeeting,
  segments: initialSegments,
  summaries: initialSummaries,
  tasks: initialTasks,
  insights: initialInsights,
  onRefresh,
}: {
  meeting: Meeting;
  segments: TranscriptSegment[];
  summaries: MeetingSummary[];
  tasks: ActionItem[];
  insights: Insight[];
  onRefresh: () => void | Promise<void>;
}) {
  const [meeting, setMeeting] = useState(initialMeeting);
  const [segments, setSegments] = useState(initialSegments);
  const [summaries, setSummaries] = useState(initialSummaries);
  const [tasks, setTasks] = useState(initialTasks);
  const [insights, setInsights] = useState(initialInsights);

  const [tab, setTab] = useState<Tab>(initialSummaries.length > 0 ? "summary" : "transcript");
  const [template, setTemplate] = useState(initialSummaries[0]?.template ?? "client_meeting");
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" | "success" } | null>(
    null
  );

  const notify = (message: string, tone: "info" | "error" | "success" = "info") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 4000);
  };

  const inFlight = ["uploading", "queued", "processing"].includes(meeting.status);

  useEffect(() => {
    if (!inFlight) return;
    const interval = setInterval(() => void onRefresh(), 4000);
    return () => clearInterval(interval);
  }, [inFlight, onRefresh]);

  useEffect(() => setMeeting(initialMeeting), [initialMeeting]);
  useEffect(() => setSegments(initialSegments), [initialSegments]);
  useEffect(() => setSummaries(initialSummaries), [initialSummaries]);
  useEffect(() => setTasks(initialTasks), [initialTasks]);
  useEffect(() => setInsights(initialInsights), [initialInsights]);

  const activeSummary = useMemo(
    () => summaries.find((s) => s.template === template) ?? summaries[0],
    [summaries, template]
  );

  async function onGenerate() {
    setGenerating(true);
    try {
      const result: SummaryPayload = await generateSummary(meeting.id, template);

      setSummaries((current) => {
        const next = current.filter((s) => s.template !== result.template);
        return [
          {
            id: `local-${result.template}`,
            template: result.template,
            overview: result.overview,
            sections: result.sections,
            model: result.model,
            created_at: new Date().toISOString(),
          },
          ...next,
        ];
      });

      await onRefresh();
      setTab("summary");
      notify("Summary ready", "success");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not generate the summary", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function onReprocess() {
    setBusy(true);
    try {
      await reprocessMeeting(meeting.id);
      setMeeting({ ...meeting, status: "queued", error_message: null });
      notify("Re-processing — the transcript will refresh automatically");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not re-process", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm(`Delete "${meeting.title}" and its audio? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteMeeting(meeting.id);
      window.location.href = "/meetings";
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not delete", "error");
      setBusy(false);
    }
  }

  async function toggleTask(task: ActionItem) {
    const next = task.status === "open" ? "done" : "open";
    setTasks((current) => current.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    try {
      await setTaskStatus(task.id, next);
    } catch {
      setTasks((current) =>
        current.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
      notify("Could not update that task", "error");
    }
  }

  function exportTranscript() {
    const body = segments
      .map((s) => `[${formatTimestamp(s.start_secs)}] ${s.speaker}: ${s.text}`)
      .join("\n");
    const header = `${meeting.title}\n${new Date(meeting.created_at).toLocaleString("en-IN")}\n${"—".repeat(50)}\n\n`;
    download(`${slugify(meeting.title)}-transcript.txt`, header + body);
  }

  function exportMarkdown() {
    const lines = [`# ${meeting.title}`, "", `_${new Date(meeting.created_at).toLocaleString("en-IN")}_`, ""];

    if (activeSummary) {
      lines.push("## Summary", "", activeSummary.overview ?? "", "");
      for (const [key, value] of Object.entries(activeSummary.sections ?? {})) {
        if (Array.isArray(value) ? value.length === 0 : !value) continue;
        lines.push(`### ${sectionLabel(key)}`, "");
        if (Array.isArray(value)) {
          value.forEach((item) => lines.push(`- ${item}`));
        } else {
          lines.push(value);
        }
        lines.push("");
      }
    }

    if (tasks.length > 0) {
      lines.push("## Action items", "");
      tasks.forEach((task) =>
        lines.push(
          `- [${task.status === "done" ? "x" : " "}] ${task.text}${task.owner ? ` — **${task.owner}**` : ""}${
            task.due_hint ? ` (${task.due_hint})` : ""
          }`
        )
      );
      lines.push("");
    }

    lines.push("## Transcript", "");
    segments.forEach((s) =>
      lines.push(`**[${formatTimestamp(s.start_secs)}] ${s.speaker}:** ${s.text}`, "")
    );

    download(`${slugify(meeting.title)}.md`, lines.join("\n"));
  }

  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-sans text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
            {meeting.title}
          </h1>
          <StatusBadge status={meeting.status} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-neutral-500 uppercase tracking-wider font-bold">
          <span className="text-neutral-400">
            {new Date(meeting.created_at).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
          <span>·</span>
          <span>{formatDuration(meeting.duration_secs)}</span>
          <span>·</span>
          <span className="text-[#6366F1] font-semibold">{languageName(meeting.language)}</span>
          <span>·</span>
          <span>{meeting.speaker_count} speakers</span>
          <span>·</span>
          <span>{segments.length} segments</span>
        </div>

        {meeting.status === "failed" && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <p className="text-sm font-sans text-red-400 font-semibold">Processing Failed</p>
            </div>
            <p className="text-xs text-red-400/90 leading-relaxed font-sans font-normal">
              {meeting.error_message ?? "Something went wrong in the pipeline."}
            </p>
            <Button variant="secondary" size="sm" onClick={onReprocess} disabled={busy}>
              {busy ? <Spinner /> : "Retry Process"}
            </Button>
          </div>
        )}

        {inFlight && (
          <div className="flex items-center gap-3 rounded-2xl border border-[#FF6B00]/25 bg-[#FF6B00]/5 px-5 py-4">
            <Spinner className="text-[#FF6B00]" />
            <p className="text-xs text-neutral-400 font-sans">
              {meeting.status === "uploading"
                ? "Recording in progress…"
                : "Transcribing Malayalam/English speech. This page updates automatically."}
            </p>
          </div>
        )}
      </div>

      {/* Control Actions Row */}
      {meeting.status === "ready" && (
        <div className="flex flex-wrap items-center gap-3 bg-[#121216]/30 border border-white/5 p-3 rounded-2xl">
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="rounded-full border border-white/10 bg-[#070709] px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider font-bold text-white focus:border-[#FF6B00]/50 outline-none transition-all cursor-pointer shrink-0"
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <Button onClick={onGenerate} disabled={generating} className="shrink-0 flex items-center gap-1.5">
            {generating ? <Spinner /> : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>{summaries.some((s) => s.template === template) ? "Regenerate" : "Generate summary"}</span>
              </>
            )}
          </Button>

          <Button variant="secondary" size="sm" onClick={exportTranscript} className="shrink-0">
            Export TXT
          </Button>
          <Button variant="secondary" size="sm" onClick={exportMarkdown} className="shrink-0">
            Export MD
          </Button>
          <Button variant="secondary" size="sm" onClick={onReprocess} disabled={busy} className="shrink-0">
            Re-clean
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete} disabled={busy} className="ml-auto shrink-0 flex items-center gap-1.5">
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </Button>
        </div>
      )}

      {/* Tabs Selector Navigation (Pill container style) */}
      <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900/60 border border-white/10 p-1 select-none">
        {(
          [
            ["summary", `Summary${summaries.length ? "" : " ·"}`],
            ["transcript", `Transcript · ${segments.length}`],
            ["tasks", `Tasks · ${tasks.length}`],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              "rounded-full px-4.5 py-2.5 font-mono text-[10px] uppercase tracking-wider font-extrabold transition-all",
              tab === id
                ? "bg-[#FF6B00] text-black shadow-md shadow-[#FF6B00]/25"
                : "text-neutral-400 hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Active Tab Panels */}
      <div className="mt-4">
        {tab === "summary" && (
          <SummaryPanel
            summary={activeSummary}
            insights={insights}
            onGenerate={onGenerate}
            generating={generating}
            ready={meeting.status === "ready"}
          />
        )}

        {tab === "transcript" && (
          <TranscriptView segments={segments} onSegmentsChange={setSegments} onNotify={notify} />
        )}

        {tab === "tasks" && <TasksPanel tasks={tasks} onToggle={toggleTask} />}
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}

function SummaryPanel({
  summary,
  insights,
  onGenerate,
  generating,
  ready,
}: {
  summary: MeetingSummary | undefined;
  insights: Insight[];
  onGenerate: () => void;
  generating: boolean;
  ready: boolean;
}) {
  if (!summary) {
    return (
      <EmptyState
        title="No summary generated yet"
        body="Choose one of the 5 custom meeting templates above and run Sonda Note's intelligence engine to produce structured action items, blockers, and details."
        action={
          ready && (
            <Button onClick={onGenerate} disabled={generating} className="mt-2 flex items-center gap-1.5">
              {generating ? <Spinner /> : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Generate Summary</span>
                </>
              )}
            </Button>
          )
        }
      />
    );
  }

  const sections = Object.entries(summary.sections ?? {}).filter(([, value]) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value)
  );

  const byKind = (kind: Insight["kind"]) => insights.filter((i) => i.kind === kind);
  const insightGroups: [Insight["kind"], string, string][] = [
    ["decision", "Decisions", "text-[#00B894]"],
    ["risk", "Risks", "text-red-400"],
    ["blocker", "Blockers", "text-[#FDCB6E]"],
    ["question", "Open questions", "text-[#6366F1]"],
  ];

  return (
    <div className="space-y-6">
      {summary.overview && (
        <Card className="space-y-3.5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[#FF6B00] font-extrabold">Overview Summary</div>
          <p className="text-sm leading-relaxed text-neutral-200">{summary.overview}</p>
          <div className="pt-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-neutral-500 font-bold">
            <span>Template: {summary.template.replace(/_/g, " ")}</span>
            <span>·</span>
            <span>Model: {summary.model}</span>
          </div>
        </Card>
      )}

      {sections.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {sections.map(([key, value]) => (
            <Card key={key} className="space-y-3.5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#FF6B00] font-extrabold">{sectionLabel(key)}</div>
              {Array.isArray(value) ? (
                <ul className="space-y-3">
                  {value.map((item, index) => (
                    <li key={index} className="flex gap-3 text-sm leading-relaxed text-neutral-400">
                      <span className="mt-1 font-mono text-[10px] text-[#00B894] font-extrabold">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-relaxed text-neutral-400">{value}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {insights.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {insightGroups.map(([kind, label, colour]) => {
            const items = byKind(kind);
            if (items.length === 0) return null;
            return (
              <Card key={kind} className="space-y-3.5">
                <div className={clsx("font-mono text-[10px] uppercase tracking-wider font-extrabold", colour)}>{label}</div>
                <ul className="space-y-3">
                  {items.map((item) => (
                    <li key={item.id} className="flex gap-3 text-sm leading-relaxed text-neutral-400">
                      <span className={clsx("mt-1 font-mono text-[10px] font-extrabold", colour)}>#</span>
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TasksPanel({
  tasks,
  onToggle,
}: {
  tasks: ActionItem[];
  onToggle: (task: ActionItem) => void;
}) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No tasks identified yet"
        body="Run Sonda Note's summary engine to automatically parse meeting transcripts and build action items."
      />
    );
  }

  return (
    <div className="bg-[#121216]/50 border border-white/10 rounded-2xl shadow-xl overflow-hidden divide-y divide-white/5">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-white/5"
        >
          {/* Custom Checkbox */}
          <div 
            onClick={() => onToggle(task)}
            className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/20 transition-all cursor-pointer select-none"
            style={{ 
              backgroundColor: task.status === "done" ? "#00B894" : "transparent",
              borderColor: task.status === "done" ? "#00B894" : "rgba(255,255,255,0.2)"
            }}
          >
            {task.status === "done" && <Check className="h-3 w-3 stroke-[3] text-black" />}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <p
              className={clsx(
                "text-sm leading-relaxed font-sans",
                task.status === "done" ? "text-neutral-500 line-through" : "text-white"
              )}
            >
              {task.text}
            </p>
            {(task.owner || task.due_hint) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500 font-bold">
                {task.owner && (
                  <span className="text-[#00B894]">
                    OWNER: {task.owner}
                  </span>
                )}
                {task.due_hint && (
                  <span className="text-[#FF6B00]">
                    DUE: {task.due_hint}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "meeting"
  );
}

function download(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
