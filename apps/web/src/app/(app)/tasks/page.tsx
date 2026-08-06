"use client";

import { useEffect, useState } from "react";

import { SectionHeading, Spinner } from "@/components/ui";
import { TasksBoard } from "@/components/tasks-board";
import { fetchTasks } from "@/lib/api";
import type { ActionItem } from "@/lib/types";

export default function TasksPage() {
  const [tasks, setTasks] = useState<ActionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks()
      .then(({ tasks }) => setTasks(tasks))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load your action items")
      );
  }, []);

  return (
    <>
      <SectionHeading kicker="Follow-ups" title="Action items" />
      <p className="mb-8 max-w-[560px] text-[13px] leading-[1.8] text-ash">
        Every commitment extracted from your meetings, grouped by owner. This is what users actually
        pay for — not ASR accuracy.
      </p>

      {error && <p className="text-[13px] text-rose">{error}</p>}

      {!error && !tasks && (
        <div className="flex justify-center py-16 text-smoke">
          <Spinner />
        </div>
      )}

      {tasks && <TasksBoard initialTasks={tasks} />}
    </>
  );
}
