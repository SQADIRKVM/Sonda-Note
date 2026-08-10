"use client";

import { useState } from "react";
import { Display } from "./display";
import { Eyebrow } from "./eyebrow";
import { TEMPLATES, VOCAB_LIST } from "../_content/vocabulary";
import { Mic, BookOpen, Sliders, ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";

export function StepRail() {
  const [activeStep, setActiveStep] = useState(0);
  const [activeTemplateId, setActiveTemplateId] = useState<string>("standup");
  const [cleanDemoMode, setCleanDemoMode] = useState<"cleaned" | "raw">("cleaned");

  const steps = [
    {
      num: "01",
      title: "Record",
      eyebrow: "CAPTURE",
      desc: "One-click Chrome extension for Google Meet. Bot-free browser audio capture without extra participants.",
    },
    {
      num: "02",
      title: "Clean",
      eyebrow: "VOCAB ENGINE",
      desc: "The Workspace Vocabulary Engine turns raw phonetic speech into your exact company terms and identifiers.",
    },
    {
      num: "03",
      title: "Summarise",
      eyebrow: "PURPOSE-BUILT TEMPLATES",
      desc: "Five domain templates: Standup, Sales, Client sync, Discovery, Sprint retro.",
    },
    {
      num: "04",
      title: "Act",
      eyebrow: "SYNC & INTEGRATIONS",
      desc: "Push action items to Slack, Notion and Jira, or query meeting memory via Claude MCP.",
    },
  ];

  const currentTemplate = TEMPLATES.find((t) => t.id === activeTemplateId) || TEMPLATES[0];

  return (
    <div id="workflow" className="space-y-12">
      <div>
        <Eyebrow text="01 – 04 / WORKFLOW" />
        <Display as="h2" size="h2">
          From live conversation to automated execution
        </Display>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Sticky Rail (≥992 Desktop) */}
        <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
          <div className="space-y-4 relative pl-4 border-l border-sn-hairline">
            {steps.map((step, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveStep(idx);
                  const el = document.getElementById(`step-card-${idx}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className={`w-full text-left p-3.5 rounded-[10px] border transition-colors ${
                  activeStep === idx
                    ? "bg-sn-surface border-sn-hairline-strong text-sn-ink"
                    : "bg-transparent border-transparent text-sn-ink-secondary hover:text-sn-ink hover:bg-sn-surface/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full border text-xs font-mono flex items-center justify-center transition-colors ${
                      activeStep === idx
                        ? "bg-sn-invert border-sn-invert text-sn-ink-on-invert"
                        : "border-sn-hairline bg-sn-surface text-sn-ink-tertiary"
                    }`}
                  >
                    {step.num}
                  </div>
                  <div>
                    <span className="font-serif text-base font-normal block">{step.title}</span>
                    <span className="font-mono text-[10px] text-sn-ink-tertiary uppercase tracking-wider">
                      {step.eyebrow}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Normally Scrolling Cards */}
        <div className="lg:col-span-8 space-y-8">
          {/* Step 1 Card: Record */}
          <div
            id="step-card-0"
            className="p-6 sm:p-8 bg-sn-surface border border-sn-hairline rounded-[12px] space-y-6"
          >
            <div className="flex items-center justify-between border-b border-sn-hairline pb-4">
              <div>
                <span className="font-mono text-xs text-sn-ink-tertiary">STEP 01</span>
                <h3 className="font-serif text-xl font-normal text-sn-ink">
                  Bot-Free Browser Audio Capture
                </h3>
              </div>
              <Mic className="w-5 h-5 text-sn-accent" />
            </div>

            <p className="text-sm font-sans text-sn-ink-secondary leading-relaxed">
              {steps[0].desc}
            </p>

            <div className="p-4 rounded-[10px] bg-sn-invert text-sn-ink-on-invert space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-sn-ink-on-invert/70 text-[11px]">
                <span>CHROME EXTENSION CAPTURE</span>
                <span className="text-sn-live-raw flex items-center gap-1 font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-sn-live-raw animate-pulse" />
                  Capturing Computer Audio
                </span>
              </div>
              <div className="p-3 bg-white/5 rounded border border-white/10 text-sn-ink-on-invert font-sans text-xs">
                "Designs for settings page ready aanu, Supabase migration script push cheythittund."
              </div>
            </div>
          </div>

          {/* Step 2 Card: Clean */}
          <div
            id="step-card-1"
            className="p-6 sm:p-8 bg-sn-surface border border-sn-hairline rounded-[12px] space-y-6"
          >
            <div className="flex items-center justify-between border-b border-sn-hairline pb-4">
              <div>
                <span className="font-mono text-xs text-sn-ink-tertiary">STEP 02</span>
                <h3 className="font-serif text-xl font-normal text-sn-ink">
                  Workspace Jargon Auto-Correction
                </h3>
              </div>
              <BookOpen className="w-5 h-5 text-sn-live" />
            </div>

            <p className="text-sm font-sans text-sn-ink-secondary leading-relaxed">
              {steps[1].desc}
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-sn-ink-tertiary">VOCABULARY MAPPING DEMO</span>
                <button
                  onClick={() => setCleanDemoMode(cleanDemoMode === "cleaned" ? "raw" : "cleaned")}
                  className="px-2.5 py-1 rounded-[6px] bg-sn-surface-raised border border-sn-hairline text-xs font-mono text-sn-accent hover:border-sn-hairline-strong transition-colors"
                >
                  Mode: {cleanDemoMode === "cleaned" ? "Cleaned" : "Raw"}
                </button>
              </div>

              <div className="bg-sn-surface-raised border border-sn-hairline rounded-[10px] divide-y divide-sn-hairline">
                {VOCAB_LIST.slice(0, 3).map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between text-xs font-mono">
                    <span className="text-sn-ink-tertiary line-through">{item.raw}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-sn-ink-tertiary" />
                    <span className="font-medium text-sn-live">{item.cleaned}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Step 3 Card: Summarise */}
          <div
            id="step-card-2"
            className="p-6 sm:p-8 bg-sn-surface border border-sn-hairline rounded-[12px] space-y-6"
          >
            <div className="flex items-center justify-between border-b border-sn-hairline pb-4">
              <div>
                <span className="font-mono text-xs text-sn-ink-tertiary">STEP 03</span>
                <h3 className="font-serif text-xl font-normal text-sn-ink">
                  Domain-Specific Summary Templates
                </h3>
              </div>
              <Sliders className="w-5 h-5 text-sn-accent" />
            </div>

            {/* Template Selector Tabs (Fix Bug §0.2#9 - drop as any) */}
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTemplateId(t.id)}
                  className={`px-3 py-1.5 rounded-[8px] text-xs font-sans font-medium border transition-colors ${
                    activeTemplateId === t.id
                      ? "bg-sn-accent-tint border-sn-accent text-sn-accent"
                      : "bg-sn-surface-raised border-sn-hairline text-sn-ink-tertiary hover:text-sn-ink"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>

            {/* Template Output Card */}
            <div className="p-4 rounded-[10px] bg-sn-surface-raised border border-sn-hairline space-y-3">
              <span className="font-serif text-base font-normal text-sn-ink block">
                {currentTemplate.name} Output
              </span>
              <p className="text-xs font-sans text-sn-ink-secondary leading-relaxed">
                {currentTemplate.summary}
              </p>
              <div className="pt-2 border-t border-sn-hairline space-y-1.5">
                <span className="font-mono text-[11px] text-sn-ink-tertiary block">ACTION ITEMS</span>
                {currentTemplate.actionItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-sans text-sn-ink">
                    <Check className="w-3.5 h-3.5 text-sn-live" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Step 4 Card: Act */}
          <div
            id="step-card-3"
            className="p-6 sm:p-8 bg-sn-surface border border-sn-hairline rounded-[12px] space-y-6"
          >
            <div className="flex items-center justify-between border-b border-sn-hairline pb-4">
              <div>
                <span className="font-mono text-xs text-sn-ink-tertiary">STEP 04</span>
                <h3 className="font-serif text-xl font-normal text-sn-ink">
                  Automated Workflow Integrations
                </h3>
              </div>
              <Sparkles className="w-5 h-5 text-sn-accent" />
            </div>

            <p className="text-sm font-sans text-sn-ink-secondary leading-relaxed">
              {steps[3].desc}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {["Slack", "Notion", "Jira", "Claude MCP"].map((dest, i) => (
                <div
                  key={i}
                  className="p-3 rounded-[8px] bg-sn-surface-raised border border-sn-hairline text-center text-xs font-sans font-medium text-sn-ink"
                >
                  {dest}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
