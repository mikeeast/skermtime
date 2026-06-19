"use client";

import { useOptimistic } from "react";
import { approveCompletion, rejectCompletion } from "../chore-actions";

export type Pending = {
  id: string;
  ai_verdict: { done?: boolean; confidence?: number; reason?: string } | null;
  chore_name: string;
  chore_icon: string | null;
  reward_minutes: number;
  child_alias: string;
  beforeUrl: string | null;
  afterUrl: string | null;
};

export function ApprovalsList({ initial }: { initial: Pending[] }) {
  const [items, removeOptimistic] = useOptimistic(
    initial,
    (state: Pending[], removedId: string) => state.filter((p) => p.id !== removedId),
  );

  async function decide(action: (fd: FormData) => Promise<void>, id: string) {
    removeOptimistic(id);
    const fd = new FormData();
    fd.set("completionId", id);
    await action(fd);
  }

  if (items.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">Inget väntar på godkännande. 🎉</p>;
  }

  return (
    <ul className="mt-4 flex flex-col gap-3">
      {items.map((p) => (
        <li key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {p.chore_icon ? `${p.chore_icon} ` : ""}
              {p.chore_name}
            </span>
            <span className="text-sm text-muted-foreground">
              {p.child_alias} · {p.reward_minutes} min
            </span>
          </div>
          {(p.beforeUrl || p.afterUrl) && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {p.beforeUrl && (
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.beforeUrl}
                    alt="Före"
                    loading="lazy"
                    className="h-32 w-full rounded-lg object-cover"
                  />
                  <figcaption className="mt-1 text-xs text-muted-foreground">Före</figcaption>
                </figure>
              )}
              {p.afterUrl && (
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.afterUrl}
                    alt="Efter"
                    loading="lazy"
                    className="h-32 w-full rounded-lg object-cover"
                  />
                  <figcaption className="mt-1 text-xs text-muted-foreground">Efter</figcaption>
                </figure>
              )}
            </div>
          )}
          {p.ai_verdict && (
            <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              AI: {p.ai_verdict.done ? "ser klar ut" : "osäker"} (
              {Math.round((p.ai_verdict.confidence ?? 0) * 100)}%) — {p.ai_verdict.reason}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <form action={() => decide(approveCompletion, p.id)}>
              <button className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700">
                Godkänn
              </button>
            </form>
            <form action={() => decide(rejectCompletion, p.id)}>
              <button className="h-9 rounded-lg border border-border px-4 text-sm font-medium transition hover:bg-muted">
                Avslå
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
