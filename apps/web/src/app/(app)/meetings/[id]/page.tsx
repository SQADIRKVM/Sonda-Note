"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import { MeetingDetail } from "@/components/meeting-detail";
import { Spinner } from "@/components/ui";
import { fetchMeetingDetail, type MeetingDetailResponse } from "@/lib/api";

export default function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<MeetingDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchMeetingDetail(id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this meeting");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Link
        href="/meetings"
        className="mb-6 inline-block font-mono text-[10px] tracking-[0.06em] text-smoke transition-colors hover:text-paper"
      >
        ← All meetings
      </Link>

      {error && (
        <div className="card px-6 py-10 text-center">
          <p className="text-[13px] text-rose">{error}</p>
        </div>
      )}

      {!error && !data && (
        <div className="flex justify-center py-20 text-smoke">
          <Spinner />
        </div>
      )}

      {data && (
        <MeetingDetail
          meeting={data.meeting}
          segments={data.segments}
          summaries={data.summaries}
          tasks={data.tasks}
          insights={data.insights}
          onRefresh={load}
        />
      )}
    </>
  );
}
