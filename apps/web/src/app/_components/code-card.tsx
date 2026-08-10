import React from "react";

export function CodeCard() {
  return (
    <div className="w-full bg-sn-surface-raised border border-sn-hairline rounded-[10px] p-5 font-mono text-xs text-sn-ink space-y-3">
      <div className="flex items-center justify-between border-b border-sn-hairline pb-2 text-[11px] text-sn-ink-tertiary">
        <span>CLAUDE MCP TOOL CALL</span>
        <span>mcp.sondanote.query</span>
      </div>

      <div className="space-y-1">
        <span className="text-sn-ink-tertiary">// Query Sonda Note meeting memory for Claude AI</span>
        <div className="text-sn-accent font-medium">
          {`> sondanote.search({ query: "Supabase RLS decision", limit: 1 })`}
        </div>
      </div>

      <div className="p-3 bg-sn-surface rounded border border-sn-hairline space-y-1.5 text-sn-ink-secondary">
        <span className="text-sn-live font-medium text-[11px] block">// Grounded Response</span>
        <p className="leading-relaxed font-sans text-xs text-sn-ink">
          "Meeting 'Sprint Sync' at 00:24 confirms team adopted Postgres RLS for workspace data isolation."
        </p>
      </div>
    </div>
  );
}
