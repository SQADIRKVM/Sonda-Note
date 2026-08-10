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
    <div className="space-y-6">
      <SectionHeading kicker="Follow-ups" title="Action items" />
      <p className="max-w-[560px] text-xs leading-relaxed text-sn-ink-secondary font-sans -mt-4">
        Every commitment extracted from your meetings, grouped by owner.
      </p>

      {error && <p className="text-xs text-sn-alert font-sans">{error}</p>}

      {!error && !tasks && (
        <div className="flex justify-center py-16 text-sn-ink-tertiary">
          <Spinner />
        </div>
      )}

      {tasks && <TasksBoard initialTasks={tasks} />}
    </div>
  );
}
