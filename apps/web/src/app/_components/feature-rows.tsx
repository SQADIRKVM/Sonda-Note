import React from "react";
import { Display } from "./display";
import { Eyebrow } from "./eyebrow";
import { CheckCircle2, Shield, Zap, Sparkles, MicOff } from "lucide-react";

export function FeatureRows() {
  const features = [
    {
      num: "01",
      title: "Malayalam and code-mixed first",
      body: "Handles Manglish and Indic speech natively. No broken literal translation, just actual comprehension.",
      icon: Sparkles,
    },
    {
      num: "02",
      title: "Per-workspace vocabulary",
      body: "A custom dictionary that learns your brand names, codebase jargon and tools, improving with every correction.",
      icon: CheckCircle2,
    },
    {
      num: "03",
      title: "Grounded, with citations",
      body: "Every summary line traces back to a timestamped moment in the transcript.",
      icon: Zap,
    },
    {
      num: "04",
      title: "No bot in the call",
      body: "Captures computer audio from the browser. Nobody sees a fourth participant appear in your Google Meet.",
      icon: MicOff,
    },
    {
      num: "05",
      title: "Private by architecture",
      body: "Postgres row-level security per workspace, with SQLite mode for fully local deployments.",
      icon: Shield,
    },
  ];

  return (
    <div className="space-y-12">
      <div>
        <Eyebrow text="WHY SONDA NOTE" />
        <Display as="h2" size="h2">
          Built for how your team actually talks
        </Display>
      </div>

      <div className="border-t border-b border-sn-hairline divide-y divide-sn-hairline bg-sn-surface rounded-[12px] overflow-hidden">
        {features.map((feat) => {
          const Icon = feat.icon;
          return (
            <div
              key={feat.num}
              className="py-8 px-6 sm:px-8 grid grid-cols-1 md:grid-cols-12 gap-4 items-center hover:bg-sn-surface-raised transition-colors group"
            >
              <div className="md:col-span-1 font-mono text-xs text-sn-ink-tertiary">
                {feat.num}
              </div>

              <div className="md:col-span-4">
                <h3 className="font-serif text-lg font-normal text-sn-ink group-hover:text-sn-accent transition-colors">
                  {feat.title}
                </h3>
              </div>

              <div className="md:col-span-6 font-sans text-sm text-sn-ink-secondary leading-relaxed">
                {feat.body}
              </div>

              <div className="md:col-span-1 flex justify-end text-sn-ink-tertiary group-hover:text-sn-accent transition-colors">
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
