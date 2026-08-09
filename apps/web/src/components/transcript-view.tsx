"use client";

import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { Search, Edit3, Save, X } from "lucide-react";
import { ApiError, correctSegment } from "@/lib/api";
import { formatTimestamp, type TranscriptSegment } from "@/lib/types";
import { Button, Card, Spinner } from "./ui";

/**
 * Transcript with inline correction — the moat's feedback loop.
 */
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
      <Card className="py-12 text-center border border-white/10 bg-[#121216]/50 rounded-2xl">
        <p className="text-sm text-neutral-400 font-sans">
          No transcript yet. It appears here once processing finishes.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Auto-Learn Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-[#121216]/30 border border-white/5 p-3 rounded-2xl">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this transcript…"
            className="w-full rounded-full border border-white/10 bg-[#070709] pl-10 pr-4 py-2 text-xs text-white placeholder:text-neutral-600 focus:border-[#FF6B00]/50 outline-none transition-all"
          />
        </div>
        
        <label className="flex cursor-pointer items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-neutral-500 font-bold select-none">
          <input
            type="checkbox"
            checked={learnVocabulary}
            onChange={(e) => setLearnVocabulary(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer accent-[#FF6B00]"
          />
          <span>Auto-learn corrections</span>
        </label>
      </div>

      {query && (
        <p className="font-mono text-[9px] uppercase tracking-wider text-neutral-500 font-bold">
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
                "group border px-5 py-4 transition-all duration-200 rounded-2xl",
                editing 
                  ? "border-[#FF6B00]/30 bg-[#FF6B00]/5 shadow-lg shadow-[#FF6B00]/5" 
                  : "border-white/5 bg-[#121216]/30 hover:border-white/10 hover:bg-[#121216]/50"
              )}
            >
              {/* Meta information row */}
              <div className="mb-2 flex items-center gap-3 font-mono text-[9px] uppercase tracking-wider font-extrabold select-none">
                <span className="text-[#FF6B00]">{segment.speaker}</span>
                <span className="text-neutral-500">{formatTimestamp(segment.start_secs)}</span>
                {corrected && !editing && (
                  <span
                    className="text-[#00B894] border border-[#00B894]/20 bg-[#00B894]/10 rounded px-1.5 py-0.5 text-[8px] font-extrabold"
                    title={`Original ASR output: ${segment.raw_text}`}
                  >
                    cleaned
                  </span>
                )}
                {segment.edited_at && !editing && (
                  <span className="text-[#6366F1] border border-[#6366F1]/20 bg-[#6366F1]/10 rounded px-1.5 py-0.5 text-[8px] font-extrabold">
                    edited
                  </span>
                )}
                {!editing && (
                  <button
                    onClick={() => startEdit(segment)}
                    className="ml-auto flex items-center gap-1 text-neutral-500 opacity-0 transition-opacity hover:text-white group-hover:opacity-100 font-bold text-[9px]"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>EDIT</span>
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
                    className="w-full resize-y rounded-xl border border-white/10 bg-[#070709] px-4 py-3.5 text-sm leading-relaxed text-white focus:border-[#FF6B00]/50 outline-none transition-all"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" onClick={() => void save(segment)} disabled={saving} className="flex items-center gap-1 px-4 py-2">
                      {saving ? <Spinner /> : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          <span>Save</span>
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving} className="px-4 py-2">
                      Cancel
                    </Button>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-500 font-bold select-none">
                      Press Enter to save · Escape to cancel
                    </span>
                  </div>
                </div>
              ) : (
                <p 
                  className="text-sm sm:text-base leading-relaxed text-neutral-200 font-sans cursor-pointer select-text" 
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
      <mark key={index} className="bg-[#FF6B00]/30 text-white rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
