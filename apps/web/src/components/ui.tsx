/**
 * UI primitives.
 *
 * Re-designed with Sonda Note's premium glassmorphic theme.
 */

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
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "px-4 py-1.5 text-xs" : "px-6 py-2.5 text-sm",
        variant === "primary" && "bg-[#FF6B00] text-black hover:bg-orange-400 shadow-[0_0_15px_rgba(255,107,0,0.2)] hover:scale-[1.02]",
        variant === "secondary" &&
          "border border-white/15 bg-white/5 text-neutral-200 hover:bg-white/10 hover:text-white",
        variant === "ghost" && "text-neutral-400 hover:bg-white/5 hover:text-white",
        variant === "danger" &&
          "border border-red-500/30 bg-red-500/10 text-red-400 hover:border-red-500 hover:bg-red-500/20",
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
        "w-full rounded-xl border border-white/10 bg-[#070709]/80 px-4 py-2.5 text-sm text-white placeholder:text-neutral-600",
        "transition-all focus:border-[#FF6B00]/50 focus:ring-1 focus:ring-[#FF6B00]/30 outline-none",
        className
      )}
      {...props}
    />
  );
}

export function StatusBadge({ status }: { status: MeetingStatus }) {
  const tone: Record<MeetingStatus, string> = {
    ready: "border-[#00B894]/30 bg-[#00B894]/10 text-[#00B894]",
    processing: "border-[#FF6B00]/30 bg-[#FF6B00]/10 text-[#FF6B00]",
    queued: "border-[#FDCB6E]/30 bg-[#FDCB6E]/10 text-[#FDCB6E]",
    uploading: "border-red-500/30 bg-red-500/10 text-red-400",
    failed: "border-red-500/30 bg-red-500/10 text-red-400",
  };

  const live = status === "processing" || status === "uploading";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-wider font-semibold",
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
    <div className={clsx("bg-[#121216]/50 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl transition-all duration-300 hover:border-orange-500/20", className)}>
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
    <div className="bg-[#121216]/40 border border-white/10 flex flex-col items-center gap-4 px-8 py-16 text-center rounded-2xl">
      <p className="font-sans text-xl font-bold tracking-tight text-white">{title}</p>
      <p className="max-w-md text-sm leading-relaxed text-neutral-400">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent",
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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#FF6B00] font-bold mb-1.5">{kicker}</div>
        <h1 className="font-sans text-3xl font-extrabold tracking-tight text-white leading-tight">
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
        "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border px-5 py-2.5 text-xs shadow-2xl font-semibold backdrop-blur-md",
        tone === "error" && "border-red-500/30 bg-red-500/10 text-red-400",
        tone === "success" && "border-[#00B894]/30 bg-[#00B894]/10 text-[#00B894]",
        tone === "info" && "border-white/10 bg-neutral-900/80 text-white"
      )}
      role="status"
    >
      {message}
    </div>
  );
}
