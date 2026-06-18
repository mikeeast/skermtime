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
    return <p className="mt-4 text-sm text-gray-500">Inget väntar på godkännande. 🎉</p>;
  }

  return (
    <ul className="mt-4 flex flex-col gap-3">
      {items.map((p) => (
        <li key={p.id} className="rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {p.chore_icon ? `${p.chore_icon} ` : ""}
              {p.chore_name}
            </span>
            <span className="text-sm text-gray-500">
              {p.child_alias} · {p.reward_minutes} min
            </span>
          </div>
          {p.ai_verdict && (
            <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
              AI: {p.ai_verdict.done ? "ser klar ut" : "osäker"} (
              {Math.round((p.ai_verdict.confidence ?? 0) * 100)}%) — {p.ai_verdict.reason}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <form action={() => decide(approveCompletion, p.id)}>
              <button className="h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white">
                Godkänn
              </button>
            </form>
            <form action={() => decide(rejectCompletion, p.id)}>
              <button className="h-9 rounded-lg border border-gray-300 px-4 text-sm font-medium">
                Avslå
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
