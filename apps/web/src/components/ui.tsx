import { clsx } from "clsx";

import type { MeetingStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium transition-all disabled:cursor-not-allowed disabled:opacity-45 select-none",
        size === "sm" ? "px-4 py-1.5 text-xs h-8" : "px-6 py-2.5 text-xs h-10 sm:h-11",
        variant === "primary" && "bg-[#191A14] text-[#FFFDF8] hover:bg-[#2E3026]",
        variant === "secondary" &&
          "border border-sn-hairline bg-sn-surface text-sn-ink hover:bg-sn-surface-raised",
        variant === "ghost" && "text-sn-ink-secondary hover:bg-black/5 hover:text-sn-ink",
        variant === "danger" &&
          "border border-sn-alert/30 bg-sn-alert-tint text-sn-alert hover:border-sn-alert",
        className
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-[8px] border border-sn-hairline bg-sn-surface px-3.5 py-2.5 text-xs text-sn-ink placeholder:text-sn-ink-tertiary",
        "transition-colors focus:border-sn-hairline-strong focus:outline-none font-sans",
        className
      )}
      {...props}
    />
  );
}

export function StatusBadge({ status }: { status: MeetingStatus }) {
  const tone: Record<MeetingStatus, string> = {
    ready: "border-sn-live/30 bg-sn-live-tint text-sn-live",
    processing: "border-sn-accent/30 bg-sn-accent-tint text-sn-accent",
    queued: "border-sn-hairline bg-sn-surface-raised text-sn-ink-secondary",
    uploading: "border-sn-alert/30 bg-sn-alert-tint text-sn-alert",
    failed: "border-sn-alert/30 bg-sn-alert-tint text-sn-alert",
  };

  const live = status === "processing" || status === "uploading";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-sans text-[11px] font-medium",
        tone[status]
      )}
    >
      {live && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx("bg-sn-surface border border-sn-hairline p-6 rounded-[12px] text-sn-ink", className)}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-sn-surface border border-sn-hairline flex flex-col items-center gap-3 px-8 py-14 text-center rounded-[12px]">
      <p className="font-serif text-2xl font-normal text-sn-ink">{title}</p>
      <p className="max-w-md text-xs leading-relaxed text-sn-ink-secondary font-sans">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-block h-4 w-4 animate-spin rounded-full border-[1.5px] border-current border-t-transparent",
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function SectionHeading({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-sn-hairline pb-4">
      <div>
        <div className="font-mono text-xs text-sn-ink-tertiary uppercase tracking-wider mb-1">{kicker}</div>
        <h1 className="font-serif text-3xl font-normal text-sn-ink leading-tight">
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}

export function Toast({
  message,
  tone = "info",
}: {
  message: string;
  tone?: "info" | "error" | "success";
}) {
  return (
    <div
      className={clsx(
        "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border px-5 py-2 text-xs shadow-lg font-sans font-medium",
        tone === "error" && "border-sn-alert/30 bg-sn-alert-tint text-sn-alert",
        tone === "success" && "border-sn-live/30 bg-sn-live-tint text-sn-live",
        tone === "info" && "border-sn-hairline bg-sn-surface text-sn-ink"
      )}
      role="status"
    >
      {message}
    </div>
  );
}
