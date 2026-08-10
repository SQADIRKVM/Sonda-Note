import React from "react";
import { Display } from "./display";
import { Eyebrow } from "./eyebrow";
import { ShieldCheck, Lock, Database, HardDrive } from "lucide-react";

export function SecurityGrid() {
  const cards = [
    {
      title: "Postgres Row-Level Security",
      body: "Database-enforced RLS policies guarantee strict multi-tenant workspace data isolation.",
      icon: Lock,
    },
    {
      title: "GDPR Tooling & Control",
      body: "Complete workspace export APIs, customizable retention windows, and one-click data deletion tooling.",
      icon: ShieldCheck,
    },
    {
      title: "Zero Bot Audio Capture",
      body: "Captured directly in the browser via Chrome tab audio. No bot participant enters your confidential calls.",
      icon: Database,
    },
    {
      title: "Self-Hosted SQLite Option",
      body: "Run Sonda Note fully offline on local hardware or private VPS infrastructure with zero cloud dependency.",
      icon: HardDrive,
    },
  ];

  return (
    <div id="security" className="space-y-12">
      <div>
        <Eyebrow text="SECURITY & PRIVACY" />
        <Display as="h2" size="h2">
          Enterprise-grade privacy by design
        </Display>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="pt-6 border-t border-sn-hairline space-y-3 hover:border-sn-hairline-strong transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-sn-ink-tertiary">0{idx + 1}</span>
                <Icon className="w-4 h-4 text-sn-accent" />
              </div>

              <h3 className="font-sans text-sm font-medium text-sn-ink leading-snug">
                {item.title}
              </h3>

              <p className="font-sans text-xs text-sn-ink-secondary leading-relaxed font-normal">
                {item.body}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
