import React from "react";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="w-full bg-sn-canvas border-t border-sn-hairline py-16 text-xs font-sans text-sn-ink-secondary">
      <div className="mx-auto max-w-max px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-[4px] bg-sn-accent text-white flex items-center justify-center text-[10px] font-mono">
                S
              </div>
              <span className="font-serif text-base font-normal text-sn-ink">Sonda Note</span>
            </div>
            <p className="text-xs text-sn-ink-tertiary leading-relaxed">
              Your Conversational Knowledge Engine. Malayalam & English code-mixed speech intelligence.
            </p>
          </div>

          {/* Product Links */}
          <div className="space-y-2">
            <span className="font-sans font-medium text-sn-ink block mb-3">Product</span>
            <ul className="space-y-2">
              <li>
                <Link href="#workflow" className="hover:text-sn-ink transition-colors">
                  Features & Workflow
                </Link>
              </li>
              <li>
                <Link href="#vocabulary" className="hover:text-sn-ink transition-colors">
                  Vocabulary Engine
                </Link>
              </li>
              <li>
                <Link href="#templates" className="hover:text-sn-ink transition-colors">
                  Summary Templates
                </Link>
              </li>
              <li>
                <Link href="#integrations" className="hover:text-sn-ink transition-colors">
                  Claude MCP Connector
                </Link>
              </li>
            </ul>
          </div>

          {/* Security Links */}
          <div className="space-y-2">
            <span className="font-sans font-medium text-sn-ink block mb-3">Security & Docs</span>
            <ul className="space-y-2">
              <li>
                <Link href="#security" className="hover:text-sn-ink transition-colors">
                  Postgres RLS Architecture
                </Link>
              </li>
              <li>
                <Link href="#security" className="hover:text-sn-ink transition-colors">
                  GDPR & Data Retention
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="hover:text-sn-ink transition-colors">
                  Pricing Plans
                </Link>
              </li>
            </ul>
          </div>

          {/* Account / Deployment */}
          <div className="space-y-2">
            <span className="font-sans font-medium text-sn-ink block mb-3">Deployment</span>
            <div className="p-3 rounded-[8px] bg-sn-surface border border-sn-hairline space-y-1.5">
              <span className="font-sans font-medium text-sn-live flex items-center gap-1.5 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-sn-live" />
                Self-Hosted & Private
              </span>
              <p className="text-[11px] text-sn-ink-tertiary leading-relaxed">
                SQLite local offline mode or Neon Serverless Postgres staging.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-sn-hairline flex flex-col sm:flex-row items-center justify-between gap-4 text-sn-ink-tertiary">
          <span>© 2026 Sonda Note BY ATMIZ. All rights reserved.</span>
          <span className="font-mono text-[11px]">
            Whisper V3 + Neon Postgres + Next.js 15
          </span>
        </div>
      </div>
    </footer>
  );
}
