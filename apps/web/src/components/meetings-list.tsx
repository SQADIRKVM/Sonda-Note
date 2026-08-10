"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { formatDuration, languageName, type Meeting } from "@/lib/types";
import { EmptyState, StatusBadge } from "./ui";

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
          <p className="font-sans text-xs text-sn-ink-tertiary">
            Google Meet extension recording · Private, isolated, and instant
          </p>
        }
      />
    );
  }

  return (
    <div className="bg-sn-surface border border-sn-hairline rounded-[14px] overflow-hidden divide-y divide-sn-hairline shadow-sm">
      {initialMeetings.map((meeting) => (
        <Link
          key={meeting.id}
          href={`/meetings/${meeting.id}`}
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-5 sm:px-8 sm:py-5.5 transition-colors duration-150 hover:bg-sn-surface-raised group"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="truncate font-serif text-xl font-normal text-sn-ink group-hover:text-sn-accent transition-colors leading-snug">
              {meeting.title}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs text-sn-ink-secondary">
              <span>
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
                  <span>{formatDuration(meeting.duration_secs)}</span>
                  <span>·</span>
                </>
              ) : null}
              {meeting.language ? (
                <>
                  <span className="text-sn-live font-medium">{languageName(meeting.language)}</span>
                  <span>·</span>
                </>
              ) : null}
              {meeting.speaker_count ? (
                <span>
                  {meeting.speaker_count} speaker{meeting.speaker_count === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>

            {meeting.status === "failed" && meeting.error_message && (
              <div className="mt-3 rounded-[10px] border border-sn-alert/30 bg-sn-alert-tint px-3.5 py-2.5 flex items-center gap-2.5 max-w-xl">
                <AlertCircle className="h-4 w-4 text-sn-alert shrink-0" />
                <p className="text-xs text-sn-alert font-sans leading-relaxed">
                  {meeting.error_message}
                </p>
              </div>
            )}
          </div>

          <div className="shrink-0 self-center">
            <StatusBadge status={meeting.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}
