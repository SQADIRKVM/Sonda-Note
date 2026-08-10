import React from "react";

interface EyebrowProps {
  text: string;
  rule?: boolean;
  onInvert?: boolean;
  className?: string;
}

export function Eyebrow({ text, rule = true, onInvert = false, className = "" }: EyebrowProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 mb-4 text-xs font-sans font-medium uppercase tracking-[0.06em] ${onInvert ? "text-sn-ink-on-invert/70" : "text-sn-ink-tertiary"} ${className}`}>
      {rule && (
        <span className={`h-[1px] w-4 ${onInvert ? "bg-sn-accent-raw" : "bg-sn-accent"}`} aria-hidden="true" />
      )}
      <span>{text}</span>
    </div>
  );
}
