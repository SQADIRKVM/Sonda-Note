"use client";

import { clsx } from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Check, Trash2, Sparkles } from "lucide-react";

import {
  deleteMeeting,
  generateSummary,
  reprocessMeeting,
  setTaskStatus,
  type SummaryPayload,
} from "@/lib/api";
import {
  formatDuration,
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
      await generateSummary(meeting.id, template);
      await onRefresh();
      setTab("summary");
      notify("Summary generated successfully", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not generate summary", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function onReprocess() {
    setBusy(true);
    try {
      await reprocessMeeting(meeting.id);
      notify("Cleaning transcript with latest vocabulary rules…", "info");
      await onRefresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Reprocessing failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm(`Delete "${meeting.title}" permanently?`)) return;
    setBusy(true);
    try {
      await deleteMeeting(meeting.id);
      window.location.href = "/meetings";
    } catch (err) {
      notify(err instanceof Error ? err.message : "Delete failed", "error");
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
      notify("Could not update task status", "error");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-sn-hairline pb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-serif text-3xl font-normal text-sn-ink">{meeting.title}</h1>
          <StatusBadge status={meeting.status} />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs text-sn-ink-secondary">
          <span>
            {new Date(meeting.created_at).toLocaleString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
          {meeting.duration_secs ? (
            <>
              <span>·</span>
              <span>{formatDuration(meeting.duration_secs)}</span>
            </>
          ) : null}
          {meeting.language ? (
            <>
              <span>·</span>
              <span className="text-sn-live font-medium">{languageName(meeting.language)}</span>
            </>
          ) : null}
          {meeting.speaker_count ? (
            <>
              <span>·</span>
              <span>{meeting.speaker_count} speakers</span>
            </>
          ) : null}
        </div>

        {inFlight && (
          <div className="flex items-center gap-3 rounded-[10px] border border-sn-accent/30 bg-sn-accent-tint px-4 py-3">
            <Spinner className="text-sn-accent" />
            <p className="text-xs text-sn-ink font-sans">
              {meeting.status === "uploading"
                ? "Recording in progress…"
                : "Transcribing Malayalam/English speech. This page updates automatically."}
            </p>
          </div>
        )}
      </div>

      {/* Control Actions Row */}
      {meeting.status === "ready" && (
        <div className="flex flex-wrap items-center gap-3 bg-sn-surface border border-sn-hairline p-3 rounded-[12px]">
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="rounded-full border border-sn-hairline bg-sn-surface-raised px-4 py-2 text-xs font-sans text-sn-ink focus:border-sn-hairline-strong outline-none transition-colors cursor-pointer shrink-0"
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

          <Button variant="secondary" size="sm" onClick={onReprocess} disabled={busy} className="shrink-0">
            Re-clean
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete} disabled={busy} className="ml-auto shrink-0 flex items-center gap-1.5">
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </Button>
        </div>
      )}

      {/* Tabs Selector Navigation */}
      <div className="inline-flex items-center gap-1 rounded-full bg-sn-surface border border-sn-hairline p-1 select-none">
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
              "rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-colors",
              tab === id
                ? "bg-[#191A14] text-[#FFFDF8]"
                : "text-sn-ink-secondary hover:text-sn-ink hover:bg-black/5"
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
        body="Select a template above and click 'Generate summary' to turn your transcript into structured notes."
        action={
          ready ? (
            <Button onClick={onGenerate} disabled={generating}>
              {generating ? <Spinner /> : "Generate summary"}
            </Button>
          ) : undefined
        }
      />
    );
  }

  const sections = Object.entries(summary.sections ?? {});

  return (
    <div className="space-y-6">
      {summary.overview && (
        <Card className="space-y-3">
          <div className="font-mono text-xs text-sn-ink-tertiary uppercase tracking-wider font-medium">Overview Summary</div>
          <p className="text-xs leading-relaxed text-sn-ink font-sans">{summary.overview}</p>
          <div className="pt-2 flex items-center gap-2 font-sans text-[11px] text-sn-ink-tertiary border-t border-sn-hairline">
            <span>Template: {summary.template.replace(/_/g, " ")}</span>
            <span>·</span>
            <span>Model: {summary.model}</span>
          </div>
        </Card>
      )}

      {sections.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {sections.map(([key, value]) => (
            <Card key={key} className="space-y-3">
              <div className="font-mono text-xs text-sn-ink-tertiary uppercase tracking-wider font-medium">{sectionLabel(key)}</div>
              {Array.isArray(value) ? (
                <ul className="space-y-2">
                  {value.map((item, index) => (
                    <li key={index} className="flex gap-2 text-xs leading-relaxed text-sn-ink-secondary font-sans">
                      <span className="text-sn-live shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs leading-relaxed text-sn-ink-secondary font-sans">{value}</p>
              )}
            </Card>
          ))}
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
    <div className="bg-sn-surface border border-sn-hairline rounded-[12px] overflow-hidden divide-y divide-sn-hairline">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-start gap-3.5 px-5 py-3.5 transition-colors hover:bg-sn-surface-raised"
        >
          <div
            onClick={() => onToggle(task)}
            className={clsx(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors cursor-pointer select-none",
              task.status === "done"
                ? "bg-sn-live border-sn-live text-white"
                : "border-sn-hairline-strong hover:border-sn-ink"
            )}
          >
            {task.status === "done" && <Check className="h-3 w-3 stroke-[3]" />}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <p
              className={clsx(
                "text-xs leading-relaxed font-sans",
                task.status === "done" ? "text-sn-ink-tertiary line-through" : "text-sn-ink"
              )}
            >
              {task.text}
            </p>
            {(task.owner || task.due_hint) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[11px] text-sn-ink-tertiary">
                {task.owner && <span className="text-sn-live font-medium">Owner: {task.owner}</span>}
                {task.due_hint && <span className="text-sn-accent font-medium">Due: {task.due_hint}</span>}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
