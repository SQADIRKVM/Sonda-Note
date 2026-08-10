"use client";

import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { Search, Edit3, Save } from "lucide-react";
import { ApiError, correctSegment } from "@/lib/api";
import { formatTimestamp, type TranscriptSegment } from "@/lib/types";
import { Button, Card, Spinner } from "./ui";

export function TranscriptView({
  segments,
  onSegmentsChange,
  onNotify,
}: {
  segments: TranscriptSegment[];
  onSegmentsChange: (segments: TranscriptSegment[]) => void;
  onNotify: (message: string, tone?: "info" | "error" | "success") => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [learnVocabulary, setLearnVocabulary] = useState(true);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return segments;
    return segments.filter(
      (segment) =>
        segment.text.toLowerCase().includes(needle) ||
        segment.speaker.toLowerCase().includes(needle)
    );
  }, [segments, query]);

  function startEdit(segment: TranscriptSegment) {
    setEditingId(segment.id);
    setDraft(segment.text);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft("");
  }

  async function save(segment: TranscriptSegment) {
    const next = draft.trim();
    if (!next || next === segment.text) {
      cancelEdit();
      return;
    }

    setSaving(true);
    try {
      await correctSegment(segment.id, next, learnVocabulary);
      onSegmentsChange(
        segments.map((s) =>
          s.id === segment.id ? { ...s, text: next, edited_at: new Date().toISOString() } : s
        )
      );
      cancelEdit();
      onNotify(
        learnVocabulary
          ? "Saved — single-word fixes are added to your workspace vocabulary"
          : "Saved",
        "success"
      );
    } catch (error) {
      onNotify(error instanceof ApiError ? error.message : "Could not save the correction", "error");
    } finally {
      setSaving(false);
    }
  }

  if (segments.length === 0) {
    return (
      <Card className="py-12 text-center">
        <p className="text-xs text-sn-ink-tertiary font-sans">
          No transcript yet. It appears here once processing finishes.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Auto-Learn Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-sn-surface border border-sn-hairline p-3 rounded-[12px]">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-sn-ink-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this transcript…"
            className="w-full rounded-full border border-sn-hairline bg-sn-surface-raised pl-9 pr-4 py-1.5 text-xs text-sn-ink placeholder:text-sn-ink-tertiary focus:border-sn-hairline-strong outline-none transition-colors"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 font-sans text-xs text-sn-ink-secondary select-none">
          <input
            type="checkbox"
            checked={learnVocabulary}
            onChange={(e) => setLearnVocabulary(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-sn-hairline text-sn-accent accent-sn-accent cursor-pointer"
          />
          <span>Auto-learn corrections</span>
        </label>
      </div>

      {query && (
        <p className="font-sans text-xs text-sn-ink-tertiary">
          Found {filtered.length} of {segments.length} matches
        </p>
      )}

      {/* Segments Stack */}
      <div className="space-y-3">
        {filtered.map((segment) => {
          const editing = editingId === segment.id;
          const corrected = segment.text !== segment.raw_text;

          return (
            <div
              key={segment.id}
              className={clsx(
                "group border px-5 py-4 transition-colors duration-150 rounded-[12px] bg-sn-surface",
                editing
                  ? "border-sn-hairline-strong bg-sn-surface-raised"
                  : "border-sn-hairline hover:border-sn-hairline-strong"
              )}
            >
              {/* Meta information row */}
              <div className="mb-2 flex items-center gap-3 font-sans text-xs select-none">
                <span className="text-sn-ink font-medium">{segment.speaker}</span>
                <span className="text-sn-ink-tertiary">{formatTimestamp(segment.start_secs)}</span>
                {corrected && !editing && (
                  <span
                    className="text-sn-live bg-sn-live-tint border border-sn-live/20 rounded px-1.5 py-0.5 text-[10px] font-medium"
                    title={`Original ASR output: ${segment.raw_text}`}
                  >
                    cleaned
                  </span>
                )}
                {segment.edited_at && !editing && (
                  <span className="text-sn-accent bg-sn-accent-tint border border-sn-accent/20 rounded px-1.5 py-0.5 text-[10px] font-medium">
                    edited
                  </span>
                )}
                {!editing && (
                  <button
                    onClick={() => startEdit(segment)}
                    className="ml-auto flex items-center gap-1 text-sn-ink-tertiary opacity-0 transition-opacity hover:text-sn-ink group-hover:opacity-100 font-sans text-xs"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              {editing ? (
                <div className="space-y-3">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void save(segment);
                      } else if (e.key === "Escape") {
                        cancelEdit();
                      }
                    }}
                    rows={Math.max(2, Math.ceil(draft.length / 90))}
                    autoFocus
                    className="w-full resize-y rounded-[8px] border border-sn-hairline bg-sn-surface px-4 py-3 text-xs leading-relaxed text-sn-ink focus:border-sn-hairline-strong outline-none transition-colors font-sans"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" onClick={() => void save(segment)} disabled={saving} className="flex items-center gap-1">
                      {saving ? <Spinner /> : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          <span>Save</span>
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                      Cancel
                    </Button>
                    <span className="font-sans text-xs text-sn-ink-tertiary select-none">
                      Press Enter to save · Escape to cancel
                    </span>
                  </div>
                </div>
              ) : (
                <p
                  className="text-sm leading-relaxed text-sn-ink font-sans cursor-pointer select-text"
                  onDoubleClick={() => startEdit(segment)}
                >
                  {query ? highlight(segment.text, query) : segment.text}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function highlight(text: string, query: string): React.ReactNode {
  const needle = query.trim();
  if (!needle) return text;

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  return parts.map((part, index) =>
    part.toLowerCase() === needle.toLowerCase() ? (
      <mark key={index} className="bg-sn-accent-tint text-sn-ink rounded px-0.5 font-normal">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
