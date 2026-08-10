import React from "react";
import { Display } from "./display";
import { Eyebrow } from "./eyebrow";
import { VOCAB_LIST } from "../_content/vocabulary";
import { ArrowRight, BookOpen } from "lucide-react";

export function VocabLogTable() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Eyebrow text="VOCABULARY ENGINE" />
          <Display as="h2" size="h2">
            Every workspace teaches it something new.
          </Display>
        </div>
        <p className="text-sm font-sans text-sn-ink-secondary max-w-narrow">
          Per-workspace jargon receipts. Phonetic Manglish terms automatically converted to exact company identifiers.
        </p>
      </div>

      {/* Hairline Table Container */}
      <div className="bg-sn-surface border border-sn-hairline rounded-[12px] overflow-hidden">
        <div className="px-6 py-3 bg-sn-surface-raised border-b border-sn-hairline grid grid-cols-12 text-xs font-mono text-sn-ink-tertiary">
          <div className="col-span-4 font-normal">RAW PHONETIC PHRASE</div>
          <div className="col-span-4 font-normal">CORRECTED WORKSPACE TERM</div>
          <div className="col-span-2 font-normal hidden sm:block">CORRECTED BY</div>
          <div className="col-span-4 sm:col-span-2 text-right font-normal">TIME</div>
        </div>

        <div className="divide-y divide-sn-hairline">
          {VOCAB_LIST.map((row) => (
            <div
              key={row.id}
              className="px-6 py-3.5 grid grid-cols-12 items-center text-xs hover:bg-sn-surface-raised transition-colors group"
            >
              <div className="col-span-4 font-mono text-sn-ink-secondary flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-sn-hairline-strong group-hover:bg-sn-accent transition-colors" />
                <span className="truncate">{row.raw}</span>
              </div>
              <div className="col-span-4 font-sans font-medium text-sn-live flex items-center gap-1.5 truncate">
                <ArrowRight className="w-3 h-3 text-sn-ink-tertiary hidden sm:inline-block" />
                <span className="truncate">{row.cleaned}</span>
              </div>
              <div className="col-span-2 font-sans text-sn-ink-tertiary hidden sm:block truncate">
                {row.correctedBy}
              </div>
              <div className="col-span-4 sm:col-span-2 text-right font-mono text-[11px] text-sn-ink-tertiary">
                {row.timestamp}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
