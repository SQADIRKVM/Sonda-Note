"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";

export function AnnouncementPill() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem("sn_announcement_dismissed");
      if (dismissed === "true") {
        setVisible(false);
      }
    }
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setVisible(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("sn_announcement_dismissed", "true");
    }
  };

  if (!visible) return null;

  return (
    <div className="w-full bg-sn-canvas border-b border-sn-hairline py-2 px-4">
      <div className="mx-auto max-w-max flex items-center justify-center gap-2">
        <Link
          href="#integrations"
          className="inline-flex items-center gap-2 text-xs font-sans font-normal text-sn-ink-secondary hover:text-sn-ink transition-colors duration-150 group"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-sn-live" aria-hidden="true" />
          <span className="font-medium text-sn-accent px-1.5 py-0.5 rounded bg-sn-accent-tint text-[11px]">NEW</span>
          <span>Claude MCP connector — use your meetings in any AI app</span>
          <ArrowRight className="w-3.5 h-3.5 text-sn-ink-tertiary group-hover:translate-x-0.5 transition-transform duration-150" />
        </Link>
        <button
          onClick={handleDismiss}
          className="text-sn-ink-tertiary hover:text-sn-ink p-1 rounded transition-colors ml-2"
          aria-label="Dismiss announcement"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
