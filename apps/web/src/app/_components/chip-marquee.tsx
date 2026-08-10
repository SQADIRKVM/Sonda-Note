import React from "react";

export function ChipMarquee() {
  const chips = [
    "Google Meet",
    "Slack",
    "Notion",
    "Jira",
    "Salesforce",
    "Claude MCP",
    "Google Drive",
    "Zoom",
    "Supabase",
    "Vercel",
    "Raycast",
    "PostgreSQL",
    "SQLite Local",
    "Whisper V3",
    "Qwen 2.5",
    "Gemini 1.5",
  ];

  // Duplicate for seamless 100% marquee scroll
  const duplicated = [...chips, ...chips];

  return (
    <div
      className="w-full overflow-hidden relative py-4"
      style={{
        maskImage:
          "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
      }}
    >
      <div className="animate-marquee gap-3">
        {duplicated.map((chip, idx) => (
          <div
            key={idx}
            className="px-4 py-2 rounded-[8px] bg-sn-surface border border-sn-hairline text-xs font-sans font-medium text-sn-ink flex items-center gap-2 shrink-0 hover:border-sn-hairline-strong transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-sn-live" aria-hidden="true" />
            <span>{chip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
