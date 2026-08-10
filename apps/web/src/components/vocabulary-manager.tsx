"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { Plus, X, ArrowRight } from "lucide-react";
import { addVocabularyTerm, ApiError, deleteVocabularyTerm } from "@/lib/api";
import type { VocabularyTerm } from "@/lib/types";
import { Button, Card, Input, Spinner, Toast } from "./ui";

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
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        <div className="space-y-6">
          {/* Add custom correction card */}
          <div className="bg-sn-surface border border-sn-hairline p-6 rounded-[12px] space-y-4">
            <div className="font-mono text-xs text-sn-ink-tertiary uppercase tracking-wider font-medium">
              Add custom correction
            </div>
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
              <ArrowRight className="h-4 w-4 text-sn-ink-tertiary shrink-0 hidden sm:block" />
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
            <p className="font-sans text-xs text-sn-ink-tertiary">
              Matching is case-insensitive and applies instantly to Malayalam-English code-mixed meeting audio.
            </p>
          </div>

          {/* Terms table */}
          {terms.length === 0 ? (
            <Card className="py-12 text-center">
              <p className="text-xs text-sn-ink-tertiary font-sans">
                No terms yet. Add your brand name, team-specific slang, and client names.
              </p>
            </Card>
          ) : (
            <div className="bg-sn-surface border border-sn-hairline rounded-[12px] overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1.5fr_0.2fr_1.5fr_0.8fr_auto] items-center gap-4 bg-sn-surface-raised border-b border-sn-hairline px-6 py-3.5 font-mono text-[11px] uppercase tracking-wider text-sn-ink-tertiary font-medium select-none">
                <span>Heard as</span>
                <span />
                <span>Corrected to</span>
                <span className="text-center">Hits</span>
                <span className="w-4" />
              </div>

              {/* Rows */}
              <div className="divide-y divide-sn-hairline">
                {terms.map((term) => (
                  <div
                    key={term.id}
                    className="group grid grid-cols-[1.5fr_0.2fr_1.5fr_0.8fr_auto] items-center gap-4 px-6 py-3.5 transition-colors hover:bg-sn-surface-raised"
                  >
                    <span className="truncate font-serif text-sm text-sn-alert line-through">
                      {term.wrong}
                    </span>
                    <span className="font-sans text-xs text-sn-ink-tertiary">→</span>
                    <span className="truncate font-serif text-sm text-sn-live font-normal">
                      {term.right_term}
                    </span>
                    <div className="text-center">
                      <span
                        className={clsx(
                          "inline-block font-sans text-xs text-sn-ink-secondary px-2 py-0.5 rounded-full text-center min-w-[32px] select-none",
                          term.source === "correction" ? "bg-sn-live-tint text-sn-live font-medium" : "bg-sn-surface-raised"
                        )}
                        title={
                          term.source === "correction"
                            ? "Learned automatically from transcript edits"
                            : "Added manually"
                        }
                      >
                        {term.hit_count}
                        {term.source === "correction" && <span className="ml-1 text-[10px]">L</span>}
                      </span>
                    </div>
                    <button
                      onClick={() => void remove(term)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-sn-ink-tertiary transition-colors hover:bg-sn-alert-tint hover:text-sn-alert"
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

        {/* Sidebar */}
        <div className="space-y-5">
          <Card>
            <div className="font-mono text-xs uppercase tracking-wider text-sn-ink-tertiary font-medium mb-3">
              Workspace statistics
            </div>
            <dl className="space-y-2.5 text-xs">
              <Row label="Total Terms" value={String(terms.length)} />
              <Row label="Learned from edits" value={String(learned)} />
              <Row label="Industry layer" value={industry.replace(/_/g, " ")} />
            </dl>
            <p className="mt-4 border-t border-sn-hairline pt-3 font-sans text-xs text-sn-ink-tertiary leading-relaxed">
              The {industry.replace(/_/g, " ")} dictionary loads automatically. Custom corrections always take precedence.
            </p>
          </Card>

          {unusedSuggestions.length > 0 && (
            <Card>
              <div className="font-mono text-xs uppercase tracking-wider text-sn-ink-tertiary font-medium mb-3">
                Suggested terms
              </div>
              <div className="space-y-2">
                {unusedSuggestions.map(([from, to]) => (
                  <button
                    key={from}
                    onClick={() => void add(from, to)}
                    disabled={busy}
                    className="flex w-full items-center gap-2 rounded-[8px] border border-sn-hairline bg-sn-surface-raised px-3.5 py-2.5 text-left font-serif text-xs transition-colors hover:border-sn-hairline-strong disabled:opacity-50 group"
                  >
                    <span className="text-sn-alert line-through truncate max-w-[80px]">{from}</span>
                    <span className="text-sn-ink-tertiary font-sans">→</span>
                    <span className="text-sn-live font-normal truncate max-w-[100px]">{to}</span>
                    <Plus className="ml-auto h-3.5 w-3.5 text-sn-ink-tertiary group-hover:text-sn-ink transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sn-ink-secondary font-sans">{label}</dt>
      <dd className="font-serif text-sn-ink text-sm font-normal">{value}</dd>
    </div>
  );
}
