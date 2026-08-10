"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ShieldCheck, Sparkles, AlertCircle, FileText, Sliders } from "lucide-react";
import { DEMO_TRANSCRIPT, TEMPLATES, VOCAB_LIST } from "../_content/vocabulary";

export function MeetingArtefact() {
  const [activeTab, setActiveTab] = useState<"transcript" | "insights">("insights");
  const [vocabMode, setVocabMode] = useState<"cleaned" | "raw">("cleaned");
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({
    task0: true,
    task1: false,
    task2: true,
  });
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const toggleTask = (id: string) => {
    setCheckedTasks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Deterministic waveform heights
  const waveformHeights = [
    12, 24, 18, 36, 42, 28, 14, 30, 48, 32, 20, 38, 22, 16, 40, 26, 18, 34, 44, 20,
    14, 28, 38, 24, 16, 42, 30, 20, 36, 22, 18, 32, 26, 14, 40, 28, 16, 34, 22, 18, 12,
  ];

  return (
    <div className="w-full bg-sn-surface border border-sn-hairline rounded-[16px] overflow-hidden transition-colors duration-150">
      {/* ─── Window Header Bar ─── */}
      <div className="px-4 py-3 bg-sn-canvas border-b border-sn-hairline flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-sn-alert-tint border border-sn-alert/30 text-sn-alert text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-sn-alert animate-pulse" />
            <span className="font-medium">REC 00:42</span>
          </div>
          <span className="font-mono text-xs text-sn-ink-tertiary truncate">
            Google Meet — Sprint Sync (Malayalam + English)
          </span>
        </div>

        {/* Tab Toggle (Fix Bug §0.2#7) */}
        <div className="flex items-center gap-1 p-1 bg-sn-surface border border-sn-hairline rounded-[8px]">
          <button
            onClick={() => setActiveTab("insights")}
            className={`px-3 py-1 text-xs font-sans font-medium rounded-[6px] transition-colors ${
              activeTab === "insights"
                ? "bg-sn-invert text-sn-ink-on-invert"
                : "text-sn-ink-tertiary hover:text-sn-ink"
            }`}
          >
            AI Insights & Summary
          </button>
          <button
            onClick={() => setActiveTab("transcript")}
            className={`px-3 py-1 text-xs font-sans font-medium rounded-[6px] transition-colors ${
              activeTab === "transcript"
                ? "bg-sn-invert text-sn-ink-on-invert"
                : "text-sn-ink-tertiary hover:text-sn-ink"
            }`}
          >
            Live Transcript
          </button>
        </div>
      </div>

      {/* ─── Audio Waveform Strip (Inversion Plate) ─── */}
      <div className="px-4 py-2.5 bg-sn-invert border-b border-sn-hairline flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-sn-ink-on-invert/70 mr-2">AUDIO ENVELOPE</span>
          <div className="flex items-center gap-[3px] h-6">
            {waveformHeights.map((h, i) => (
              <span
                key={i}
                className="w-[2px] bg-sn-live-raw opacity-90 rounded-full transition-all duration-300"
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
        </div>

        {/* Raw / Cleaned Toggle (Fix Bug §0.2#8) */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-sn-ink-on-invert/70">VOCAB MODE:</span>
          <button
            onClick={() => setVocabMode(vocabMode === "cleaned" ? "raw" : "cleaned")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-sn-surface/10 border border-sn-hairline/20 text-sn-ink-on-invert text-xs font-mono hover:bg-sn-surface/20 transition-colors"
          >
            <Sliders className="w-3 h-3 text-sn-live-raw" />
            <span>{vocabMode === "cleaned" ? "Cleaned (Sonda)" : "Raw Phonetic"}</span>
          </button>
        </div>
      </div>

      {/* ─── Body Container ─── */}
      <div className="p-4 sm:p-6 bg-sn-surface min-h-[420px]">
        <AnimatePresence mode="wait">
          {activeTab === "transcript" ? (
            /* Full Width Live Transcript View */
            <motion.div
              key="transcript-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              data-lenis-prevent
              className="max-h-[380px] overflow-y-auto space-y-3.5 pr-2"
            >
              {DEMO_TRANSCRIPT.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 rounded-[12px] bg-sn-surface-raised border border-sn-hairline space-y-2 hover:border-sn-hairline-strong transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-sn-accent-tint text-sn-accent font-sans font-medium text-[11px] flex items-center justify-center">
                        {entry.avatarInitials}
                      </div>
                      <span className="font-sans font-medium text-sn-ink">{entry.speaker}</span>
                      {entry.verified && (
                        <span className="px-2 py-0.5 rounded-[6px] bg-sn-live-tint border border-sn-live/30 text-sn-live text-[10px] font-sans font-medium flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          VERIFIED
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-sn-ink-tertiary">{entry.timestamp}</span>
                  </div>

                  <p className="text-sm font-sans leading-relaxed text-sn-ink">
                    {vocabMode === "cleaned" ? (
                      <>
                        {entry.cleanedText.split(entry.highlightedTerm || "").map((part, i, arr) => (
                          <span key={i}>
                            {part}
                            {i < arr.length - 1 && (
                              <span
                                className="relative inline-block px-1.5 py-0.5 rounded-[6px] bg-sn-live-tint border border-sn-live/30 text-sn-live font-mono text-xs underline decoration-dashed underline-offset-4 cursor-pointer"
                                onClick={() =>
                                  setActiveTooltip(activeTooltip === entry.id ? null : entry.id)
                                }
                                onMouseEnter={() => setActiveTooltip(entry.id)}
                                onMouseLeave={() => setActiveTooltip(null)}
                                role="tooltip"
                                tabIndex={0}
                              >
                                {entry.highlightedTerm}
                                {activeTooltip === entry.id && (
                                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-sn-surface border border-sn-hairline rounded-[8px] text-[11px] font-sans text-sn-ink shadow-sm z-50 pointer-events-none">
                                    {entry.tooltipText}
                                  </span>
                                )}
                              </span>
                            )}
                          </span>
                        ))}
                      </>
                    ) : (
                      <span className="font-mono text-xs text-sn-ink-secondary">{entry.rawText}</span>
                    )}
                  </p>
                </div>
              ))}
            </motion.div>
          ) : (
            /* AI Insights & Summary Board Split View */
            <motion.div
              key="insights-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Left Column: Live Transcript Preview Stream */}
              <div
                data-lenis-prevent
                className="lg:col-span-6 max-h-[380px] overflow-y-auto space-y-3 pr-2 border-r-0 lg:border-r border-sn-hairline lg:pr-6"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-sn-ink-tertiary uppercase tracking-wider">
                    SPEECH STREAM
                  </span>
                  <span className="font-sans text-xs text-sn-live flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-sn-live" />
                    Cleaned Real-Time
                  </span>
                </div>

                {DEMO_TRANSCRIPT.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-[12px] bg-sn-surface-raised border border-sn-hairline space-y-1.5 hover:border-sn-hairline-strong transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-sans font-medium text-sn-ink">{entry.speaker}</span>
                        <span className="font-mono text-[10px] text-sn-ink-tertiary">{entry.timestamp}</span>
                      </div>
                    </div>
                    <p className="text-xs font-sans leading-relaxed text-sn-ink-secondary">
                      {vocabMode === "cleaned" ? entry.cleanedText : entry.rawText}
                    </p>
                  </div>
                ))}
              </div>

              {/* Right Column: Grounded AI Summary & Action Items Board */}
              <div
                data-lenis-prevent
                className="lg:col-span-6 max-h-[380px] overflow-y-auto space-y-4"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs text-sn-accent uppercase tracking-wider flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-sn-accent" />
                    AI MEETING INTELLIGENCE
                  </span>
                </div>

                {/* Summary Card */}
                <div className="p-3.5 rounded-[12px] bg-sn-surface-raised border border-sn-hairline space-y-1.5">
                  <span className="font-sans text-xs font-medium text-sn-ink block">Executive Summary</span>
                  <p className="text-xs leading-relaxed text-sn-ink-secondary">
                    Team completed settings designs and approved Supabase RLS migrations. Razorpay sandbox CORS issue was resolved today. Deploying Sonda Note Chrome Extension build.
                  </p>
                </div>

                {/* Blocker Detected */}
                <div className="p-3.5 rounded-[12px] bg-sn-alert-tint border border-sn-alert/30 text-sn-alert space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-sans font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>BLOCKER DETECTED</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">
                    Staging deployment pending final verification of Neon Postgres RLS rules before public launch.
                  </p>
                </div>

                {/* Action Items List */}
                <div className="p-3.5 rounded-[12px] bg-sn-surface-raised border border-sn-hairline space-y-2.5">
                  <span className="font-sans text-xs font-medium text-sn-ink block">
                    Action Items (Grouped by Owner)
                  </span>

                  <div className="space-y-2">
                    {[
                      { id: "task0", text: "Sarhan: Push Supabase RLS migration script", owner: "Sarhan Qadir" },
                      { id: "task1", text: "Anjali: Verify Figma design components", owner: "Anjali Nair" },
                      { id: "task2", text: "Deploy dashboard build to Vercel", owner: "DevOps" },
                    ].map((task) => (
                      <button
                        key={task.id}
                        onClick={() => toggleTask(task.id)}
                        className="w-full flex items-center gap-2.5 text-left p-2 rounded-[8px] hover:bg-sn-canvas border border-transparent hover:border-sn-hairline transition-colors group"
                      >
                        <div
                          className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${
                            checkedTasks[task.id]
                              ? "bg-sn-live border-sn-live text-white"
                              : "border-sn-hairline-strong bg-sn-surface group-hover:border-sn-ink"
                          }`}
                        >
                          {checkedTasks[task.id] && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span
                          className={`text-xs font-sans ${
                            checkedTasks[task.id]
                              ? "line-through text-sn-ink-tertiary"
                              : "text-sn-ink font-normal"
                          }`}
                        >
                          {task.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
