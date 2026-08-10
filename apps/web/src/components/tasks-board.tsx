"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useMemo, useState } from "react";
import { setTaskStatus } from "@/lib/api";
import type { ActionItem } from "@/lib/types";
import { Card, EmptyState, Toast } from "./ui";
import { Check } from "lucide-react";

const UNASSIGNED = "Unassigned";

export function TasksBoard({ initialTasks }: { initialTasks: ActionItem[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [toast, setToast] = useState<string | null>(null);

  const visible = useMemo(
    () => (filter === "all" ? tasks : tasks.filter((t) => t.status === filter)),
    [tasks, filter]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ActionItem[]>();
    for (const task of visible) {
      const owner = task.owner?.trim() || UNASSIGNED;
      const list = map.get(owner) ?? [];
      list.push(task);
      map.set(owner, list);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === UNASSIGNED) return 1;
      if (b === UNASSIGNED) return -1;
      return a.localeCompare(b);
    });
  }, [visible]);

  async function toggle(task: ActionItem) {
    const next = task.status === "open" ? "done" : "open";
    setTasks((current) => current.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    try {
      await setTaskStatus(task.id, next);
    } catch {
      setTasks((current) =>
        current.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
      setToast("Could not update that task");
      setTimeout(() => setToast(null), 3000);
    }
  }

  const openCount = tasks.filter((t) => t.status === "open").length;
  const doneCount = tasks.length - openCount;

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No action items yet"
        body="Generate a summary on any meeting and the commitments people made will show up here, grouped by owner."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Category Filters in Rounded Pill Badges */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["open", `Open · ${openCount}`],
            ["done", `Done · ${doneCount}`],
            ["all", `All · ${tasks.length}`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={clsx(
              "rounded-full px-4 py-1 font-sans text-xs font-medium transition-all select-none",
              filter === value
                ? "bg-sn-invert text-sn-ink-on-invert"
                : "bg-sn-surface border border-sn-hairline text-sn-ink-secondary hover:text-sn-ink hover:border-sn-hairline-strong"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-xs text-sn-ink-tertiary font-sans">
            {filter === "open" ? "Nothing open. Everything is done." : "Nothing here."}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([owner, ownerTasks]) => (
            <div key={owner} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    "font-sans text-xs font-medium",
                    owner === UNASSIGNED ? "text-sn-ink-tertiary" : "text-sn-live"
                  )}
                >
                  {owner}
                </span>
                <span className="font-sans text-[11px] bg-sn-surface border border-sn-hairline rounded-full px-2 py-0.5 text-sn-ink-tertiary">
                  {ownerTasks.length}
                </span>
                <span className="h-px flex-1 bg-sn-hairline" />
              </div>

              {/* Surface card with divide lines between rows */}
              <div className="bg-sn-surface border border-sn-hairline rounded-[12px] overflow-hidden divide-y divide-sn-hairline">
                {ownerTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3.5 px-5 py-3.5 transition-colors hover:bg-sn-surface-raised"
                  >
                    <div
                      onClick={() => void toggle(task)}
                      className={clsx(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors cursor-pointer select-none",
                        task.status === "done"
                          ? "bg-sn-live border-sn-live text-white"
                          : "border-sn-hairline-strong hover:border-sn-ink"
                      )}
                    >
                      {task.status === "done" && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <p
                        className={clsx(
                          "text-xs leading-relaxed font-sans",
                          task.status === "done" ? "text-sn-ink-tertiary line-through" : "text-sn-ink"
                        )}
                      >
                        {task.text}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[11px] text-sn-ink-tertiary">
                        {task.due_hint && (
                          <span className="text-sn-accent font-medium">
                            Due: {task.due_hint}
                          </span>
                        )}
                        {task.meetings && (
                          <Link
                            href={`/meetings/${task.meetings.id}`}
                            className="truncate hover:text-sn-ink transition-colors"
                          >
                            Meeting: {task.meetings.title}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <Toast message={toast} tone="error" />}
    </div>
  );
}
