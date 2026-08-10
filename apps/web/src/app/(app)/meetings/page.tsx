"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { MeetingsList } from "@/components/meetings-list";
import { Spinner } from "@/components/ui";
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
      <div className="bg-sn-alert-tint border border-sn-alert/30 px-6 py-10 text-center rounded-[12px]">
        <p className="text-sm leading-relaxed text-sn-alert font-sans">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center py-20 text-sn-ink-tertiary">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Workspace Header */}
      <div className="border-b border-sn-hairline pb-6">
        <span className="font-mono text-xs uppercase tracking-wider text-sn-ink-tertiary">
          Workspace
        </span>
        <h1 className="font-serif text-3xl font-normal text-sn-ink mt-1">
          {data.workspace.name}
        </h1>
      </div>

      {/* Grid of clean Granola-style metric cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat value={String(data.stats.meetings)} label="Meetings recorded" />
        <Stat value={String(data.stats.minutes)} label="Minutes transcribed" />
        <Stat value={String(data.stats.open_tasks)} label="Open action items" href="/tasks" />
        <Stat
          value={String(data.stats.vocabulary_terms)}
          label="Vocabulary terms"
          href="/vocabulary"
        />
      </div>

      <MeetingsList initialMeetings={data.meetings} onRefresh={load} />
    </div>
  );
}

function Stat({ value, label, href }: { value: string; label: string; href?: string }) {
  const body = (
    <div className="bg-sn-surface border border-sn-hairline hover:border-sn-hairline-strong px-5 py-5 transition-all duration-200 rounded-[12px] h-full flex flex-col justify-between">
      <div className="font-serif text-3xl font-normal text-sn-ink">
        {value}
      </div>
      <div className="mt-2 font-sans text-xs text-sn-ink-secondary">{label}</div>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
