"use client";

import { useState } from "react";
import { Search, Play, Pause, Sparkles, Command } from "lucide-react";

export function RagSearchCard() {
  const [query, setQuery] = useState("Why did we switch to Supabase RLS?");
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="w-full bg-sn-surface border border-sn-hairline rounded-[12px] p-6 space-y-6">
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-sn-ink-tertiary absolute left-4" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search meeting memory..."
          className="w-full pl-10 pr-12 py-3 bg-sn-surface-raised border border-sn-hairline rounded-[10px] text-xs font-sans text-sn-ink focus:border-sn-hairline-strong transition-colors"
        />
        <div className="absolute right-3 px-2 py-0.5 rounded bg-sn-canvas border border-sn-hairline text-[10px] font-mono text-sn-ink-tertiary flex items-center gap-1">
          <Command className="w-2.5 h-2.5" />
          <span>K</span>
        </div>
      </div>

      {/* RAG Match Response Card */}
      <div className="p-4 rounded-[10px] bg-sn-surface-raised border border-sn-hairline space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-sn-accent font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            GROUNDED MATCH (98.4% RELEVANCE)
          </span>

          <span className="px-2 py-0.5 rounded bg-sn-invert text-sn-ink-on-invert font-mono text-[10px]">
            00:24
          </span>
        </div>

        <blockquote className="text-xs font-serif italic leading-relaxed text-sn-ink border-l-2 border-sn-accent pl-3">
          "We needed Postgres Row-Level Security so each workspace has isolated data access, plus zero-latency SQLite for local offline development."
        </blockquote>

        {/* Audio Player Controls */}
        <div className="pt-3 border-t border-sn-hairline flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlayback}
              className="w-7 h-7 rounded-full bg-sn-invert text-sn-ink-on-invert flex items-center justify-center hover:bg-[#1A1B17] transition-colors"
              aria-label={isPlaying ? "Pause audio clip" : "Play audio clip"}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
            </button>
            <span className="font-sans font-medium text-sn-ink">Sprint Sync 00:24 – 00:29</span>
          </div>

          <span className="font-mono text-[10px] text-sn-ink-tertiary">3.2MB audio chunk</span>
        </div>
      </div>
    </div>
  );
}
