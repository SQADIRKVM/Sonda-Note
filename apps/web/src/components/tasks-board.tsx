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

  /** Group by owner so a standup can be read one person at a time. */
  const grouped = useMemo(() => {
    const map = new Map<string, ActionItem[]>();
    for (const task of visible) {
      const owner = task.owner?.trim() || UNASSIGNED;
      const list = map.get(owner) ?? [];
      list.push(task);
      map.set(owner, list);
    }
    // Named owners first, alphabetically; Unassigned last.
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
    <>
      {/* Category Filters in Rounded Pill Badges */}
      <div className="mb-8 flex flex-wrap gap-2">
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
              "rounded-full px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider font-semibold border transition-all",
              filter === value 
                ? "bg-[#FF6B00]/10 border-[#FF6B00]/30 text-[#FF6B00]" 
                : "border-white/10 text-neutral-400 hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card className="py-12 text-center border border-white/10 bg-[#121216]/50 rounded-2xl">
          <p className="text-sm text-neutral-400 font-sans">
            {filter === "open" ? "Nothing open. Everything is done." : "Nothing here."}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([owner, ownerTasks]) => (
            <div key={owner} className="space-y-3">
              <div className="flex items-center gap-3">
                <span
                  className={clsx(
                    "font-mono text-[10px] uppercase tracking-wider font-extrabold",
                    owner === UNASSIGNED ? "text-neutral-500" : "text-[#00B894]"
                  )}
                >
                  {owner}
                </span>
                <span className="font-mono text-[9px] font-bold bg-white/5 border border-white/10 rounded-full px-2 py-0.5 text-neutral-400">
                  {ownerTasks.length}
                </span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              {/* Glass container with divide lines between rows */}
              <div className="bg-[#121216]/50 border border-white/10 rounded-2xl shadow-xl overflow-hidden divide-y divide-white/5">
                {ownerTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-white/5"
                  >
                    <div 
                      onClick={() => void toggle(task)}
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/20 transition-all cursor-pointer select-none"
                      style={{ 
                        backgroundColor: task.status === "done" ? "#00B894" : "transparent",
                        borderColor: task.status === "done" ? "#00B894" : "rgba(255,255,255,0.2)"
                      }}
                    >
                      {task.status === "done" && <Check className="h-3 w-3 stroke-[3] text-black" />}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <p
                        className={clsx(
                          "text-sm leading-relaxed font-sans",
                          task.status === "done" ? "text-neutral-500 line-through" : "text-white"
                        )}
                      >
                        {task.text}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500 font-bold">
                        {task.due_hint && (
                          <span className="text-[#FF6B00] border border-[#FF6B00]/20 bg-[#FF6B00]/10 rounded px-1.5 py-0.5">
                            DUE: {task.due_hint}
                          </span>
                        )}
                        {task.meetings && (
                          <Link
                            href={`/meetings/${task.meetings.id}`}
                            className="truncate text-neutral-400 hover:text-[#FF6B00] transition-colors"
                          >
                            MEETING: {task.meetings.title}
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
    </>
  );
}
