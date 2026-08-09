"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { Plus, X, ArrowRight } from "lucide-react";
import { addVocabularyTerm, ApiError, deleteVocabularyTerm } from "@/lib/api";
import type { VocabularyTerm } from "@/lib/types";
import { Button, Card, Input, Spinner, Toast } from "./ui";

/** Seed suggestions from the spec's example workspace (sondanote.com). */
const SUGGESTIONS: [string, string][] = [
  ["at miss", "Sonda Note"],
  ["super base", "Supabase"],
  ["figure ma", "Figma"],
  ["post grass", "Postgres"],
  ["loveable", "Lovable"],
  ["raise pay", "Razorpay"],
];

export function VocabularyManager({
  initialTerms,
  industry,
}: {
  initialTerms: VocabularyTerm[];
  industry: string;
}) {
  const [terms, setTerms] = useState(initialTerms);
  const [wrong, setWrong] = useState("");
  const [right, setRight] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "error" | "success" } | null>(null);

  const notify = (message: string, tone: "error" | "success") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3500);
  };

  async function add(wrongValue: string, rightValue: string) {
    const from = wrongValue.trim();
    const to = rightValue.trim();
    if (!from || !to) return;

    setBusy(true);
    try {
      const { term } = await addVocabularyTerm(from, to);
      setTerms((current) => [term, ...current.filter((t) => t.id !== term.id)]);
      setWrong("");
      setRight("");
      notify(`"${from}" → "${to}" added`, "success");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not add that term", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(term: VocabularyTerm) {
    const previous = terms;
    setTerms((current) => current.filter((t) => t.id !== term.id));
    try {
      await deleteVocabularyTerm(term.id);
    } catch {
      setTerms(previous);
      notify("Could not delete that term", "error");
    }
  }

  const unusedSuggestions = SUGGESTIONS.filter(
    ([from]) => !terms.some((t) => t.wrong.toLowerCase() === from.toLowerCase())
  );

  const learned = terms.filter((t) => t.source === "correction").length;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        <div className="space-y-6">
          {/* add form */}
          <div className="bg-[#121216]/50 border border-white/10 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Add custom correction</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void add(wrong, right);
              }}
              className="flex flex-wrap items-center gap-3"
            >
              <Input
                value={wrong}
                onChange={(e) => setWrong(e.target.value)}
                placeholder="What ASR hears (e.g. at miss)"
                className="min-w-[160px] flex-1"
                maxLength={200}
              />
              <ArrowRight className="h-4 w-4 text-neutral-500 shrink-0 hidden sm:block" />
              <Input
                value={right}
                onChange={(e) => setRight(e.target.value)}
                placeholder="What it should be (e.g. Sonda Note)"
                className="min-w-[160px] flex-1"
                maxLength={200}
              />
              <Button type="submit" disabled={busy || !wrong.trim() || !right.trim()} className="shrink-0">
                {busy ? <Spinner /> : "Add Correction"}
              </Button>
            </form>
            <p className="font-mono text-[9px] uppercase tracking-wider text-neutral-500">
              Matching is case-insensitive and applies instantly to Malayalam-English code-mixed meeting audio.
            </p>
          </div>

          {/* terms table */}
          {terms.length === 0 ? (
            <Card className="py-12 text-center border border-white/10 bg-[#121216]/50 rounded-2xl">
              <p className="text-sm text-neutral-400 font-sans">
                No terms yet. Add your brand name, team-specific slang, and client names to tune ASR accuracy.
              </p>
            </Card>
          ) : (
            <div className="bg-[#121216]/50 border border-white/10 rounded-2xl shadow-xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1.5fr_0.2fr_1.5fr_0.8fr_auto] items-center gap-4 bg-neutral-950/80 border-b border-white/5 px-6 py-4.5 font-mono text-[9px] uppercase tracking-wider text-[#FF6B00] font-extrabold select-none">
                <span>Heard as</span>
                <span />
                <span>Corrected to</span>
                <span className="text-center">Hits</span>
                <span className="w-4" />
              </div>

              {/* Rows */}
              <div className="divide-y divide-white/5">
                {terms.map((term) => (
                  <div
                    key={term.id}
                    className="group grid grid-cols-[1.5fr_0.2fr_1.5fr_0.8fr_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-white/5"
                  >
                    <span className="truncate font-mono text-xs text-red-400/80 line-through">
                      {term.wrong}
                    </span>
                    <span className="font-mono text-xs text-neutral-600">→</span>
                    <span className="truncate font-mono text-xs text-[#00B894] font-bold">
                      {term.right_term}
                    </span>
                    <div className="text-center">
                      <span
                        className={clsx(
                          "inline-block font-mono text-xs text-neutral-400 px-2 py-0.5 rounded-full text-center min-w-[32px] select-none",
                          term.source === "correction" ? "bg-[#6366F1]/10 text-[#6366F1] font-bold" : "bg-white/5 text-neutral-400"
                        )}
                        title={
                          term.source === "correction"
                            ? "Learned automatically from transcript edits"
                            : "Added manually"
                        }
                      >
                        {term.hit_count}
                        {term.source === "correction" && <span className="ml-1 text-[9px] font-bold">L</span>}
                      </span>
                    </div>
                    <button
                      onClick={() => void remove(term)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/0 text-neutral-500 transition-all hover:bg-red-500/10 hover:text-red-400"
                      aria-label={`Delete ${term.wrong}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* sidebar */}
        <div className="space-y-5">
          <Card className="bg-[#121216]/50 border border-white/10 rounded-2xl shadow-xl">
            <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-4">Workspace statistics</div>
            <dl className="space-y-3 text-sm">
              <Row label="Total Terms" value={String(terms.length)} />
              <Row label="Learned from edits" value={String(learned)} />
              <Row label="Industry layer" value={industry.replace(/_/g, " ")} />
            </dl>
            <p className="mt-5 border-t border-white/10 pt-4 font-mono text-[9px] uppercase tracking-wider text-neutral-500 leading-relaxed">
              The {industry.replace(/_/g, " ")} dictionary loads automatically. Custom corrections always take precedence.
            </p>
          </Card>

          {unusedSuggestions.length > 0 && (
            <Card className="bg-[#121216]/50 border border-white/10 rounded-2xl shadow-xl">
              <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-3">Suggested terms</div>
              <div className="space-y-1.5">
                {unusedSuggestions.map(([from, to]) => (
                  <button
                    key={from}
                    onClick={() => void add(from, to)}
                    disabled={busy}
                    className="flex w-full items-center gap-2 rounded-xl border border-white/5 bg-[#070709]/50 px-3.5 py-2.5 text-left font-mono text-xs transition-all hover:border-[#FF6B00]/30 hover:bg-[#FF6B00]/5 disabled:opacity-50 group"
                  >
                    <span className="text-red-400/80 line-through truncate max-w-[80px]">{from}</span>
                    <span className="text-neutral-600">→</span>
                    <span className="text-[#00B894] font-bold truncate max-w-[100px]">{to}</span>
                    <Plus className="ml-auto h-3.5 w-3.5 text-neutral-500 group-hover:text-white transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-neutral-400 font-sans font-medium">{label}</dt>
      <dd className="font-mono text-white font-bold">{value}</dd>
    </div>
  );
}
