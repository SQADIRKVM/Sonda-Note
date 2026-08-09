"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { formatDuration, languageName, type Meeting } from "@/lib/types";
import { EmptyState, StatusBadge } from "./ui";

/**
 * Meeting list with live status.
 *
 * Polls while anything is mid-pipeline so a recording started from the extension
 * advances (queued → processing → ready) without a manual refresh. Polling stops
 * once everything settles, so an idle dashboard makes no requests.
 */
export function MeetingsList({
  initialMeetings,
  onRefresh,
}: {
  initialMeetings: Meeting[];
  onRefresh: () => void | Promise<void>;
}) {
  const inFlight = initialMeetings.some((m) =>
    ["uploading", "queued", "processing"].includes(m.status)
  );

  useEffect(() => {
    if (!inFlight) return;
    const interval = setInterval(() => void onRefresh(), 4000);
    return () => clearInterval(interval);
  }, [inFlight, onRefresh]);

  if (initialMeetings.length === 0) {
    return (
      <EmptyState
        title="No meetings yet"
        body="Open a Google Meet call, click the Sonda Note extension, and hit record. Your transcript will show up here when processing finishes."
        action={
          <p className="font-mono text-[10px] leading-relaxed text-neutral-500 tracking-wider">
            GOOGLE MEET ONLY · ZOOM AND TEAMS DESKTOP CAPTURES ARE NOT SUPPORTED FROM BROWSER TABS
          </p>
        }
      />
    );
  }

  return (
    <div className="bg-[#121216]/50 border border-white/10 rounded-2xl shadow-xl overflow-hidden divide-y divide-white/5">
      {initialMeetings.map((meeting) => (
        <Link
          key={meeting.id}
          href={`/meetings/${meeting.id}`}
          className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 px-6 py-5 transition-all duration-200 hover:bg-white/5"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="truncate font-sans text-base font-bold text-white hover:text-[#FF6B00] transition-colors">
              {meeting.title}
            </div>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-neutral-500 uppercase tracking-wider">
              <span className="text-neutral-400">
                {new Date(meeting.created_at).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <span>·</span>
              {meeting.duration_secs ? (
                <>
                  <span className="text-neutral-400">{formatDuration(meeting.duration_secs)}</span>
                  <span>·</span>
                </>
              ) : null}
              {meeting.language ? (
                <>
                  <span className="text-[#6366F1] font-semibold">{languageName(meeting.language)}</span>
                  <span>·</span>
                </>
              ) : null}
              {meeting.speaker_count ? (
                <span className="text-neutral-400">
                  {meeting.speaker_count} speaker{meeting.speaker_count === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>

            {meeting.status === "failed" && meeting.error_message && (
              <div className="mt-2.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 flex items-center gap-2 max-w-xl">
                <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                <p className="text-[11px] leading-relaxed text-red-400 font-sans font-normal">
                  {meeting.error_message}
                </p>
              </div>
            )}
          </div>
          
          <div className="shrink-0">
            <StatusBadge status={meeting.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}
