"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { MeetingsList } from "@/components/meetings-list";
import { SectionHeading, Spinner } from "@/components/ui";
import { fetchOverview, type OverviewResponse } from "@/lib/api";

export default function MeetingsPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchOverview());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your workspace");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="bg-[#121216]/40 border border-white/10 px-6 py-10 text-center rounded-2xl">
        <p className="text-sm leading-relaxed text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center py-20 text-neutral-600">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <SectionHeading kicker="WORKSPACE" title={data.workspace.name} />

      {/* Grid of separate glass metric cards */}
      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat value={String(data.stats.meetings)} label="meetings" />
        <Stat value={String(data.stats.minutes)} label="minutes recorded" />
        <Stat value={String(data.stats.open_tasks)} label="open action items" href="/tasks" />
        <Stat
          value={String(data.stats.vocabulary_terms)}
          label="vocabulary terms"
          href="/vocabulary"
        />
      </div>

      <MeetingsList initialMeetings={data.meetings} onRefresh={load} />
    </>
  );
}

function Stat({ value, label, href }: { value: string; label: string; href?: string }) {
  const body = (
    <div className="bg-[#121216]/50 border border-white/10 hover:border-orange-500/20 px-6 py-6 transition-all duration-300 rounded-2xl shadow-md hover:-translate-y-0.5 select-none h-full flex flex-col justify-between">
      <div className="font-sans text-3xl font-extrabold tracking-tight text-white">
        {value}
      </div>
      <div className="mt-2.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500 font-bold">{label}</div>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
