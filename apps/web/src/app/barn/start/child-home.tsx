"use client";

import { useOptimistic, useState } from "react";
import { logChore } from "../actions";
import { formatMinutes } from "@/lib/earning/format";
import { Mascot } from "@/components/mascot";

type ChoreOpt = {
  id: string;
  name: string;
  icon: string | null;
  reward_minutes: number;
  approval_mode: string;
};
type LedgerEntry = {
  id: string;
  delta_minutes: number;
  kind: string;
  note: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  earn_chore: "Syssla",
  earn_strava: "Löprunda",
  spend: "Förbrukad",
  adjust: "Justering",
  bounty: "Bonus",
  clawback: "Återtag",
};

export function ChildHome({
  initialBalance,
  chores,
  ledger,
  stravaConnected,
}: {
  initialBalance: number;
  chores: ChoreOpt[];
  ledger: LedgerEntry[];
  stravaConnected?: boolean;
}) {
  const [balance, addBalance] = useOptimistic(initialBalance, (b: number, delta: number) => b + delta);
  const [flash, setFlash] = useState<string | null>(null);

  async function onDo(c: ChoreOpt) {
    if (c.approval_mode === "auto") addBalance(c.reward_minutes);
    setFlash(c.id);
    setTimeout(() => setFlash((cur) => (cur === c.id ? null : cur)), 2000);
    const fd = new FormData();
    fd.set("choreId", c.id);
    await logChore(fd);
  }

  return (
    <>
      <section className="flex items-center justify-center gap-4 rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
        <Mascot className="h-20 w-20 shrink-0" />
        <div>
          <p className="text-sm text-muted-foreground">Din skärmtid</p>
          <p className="mt-1 text-5xl font-bold tabular-nums">{formatMinutes(balance)}</p>
        </div>
      </section>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        {stravaConnected ? "🏃 Strava kopplat" : "Be en förälder koppla din Strava"}
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Mina sysslor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tryck när du gjort något — så tjänar du tid!
        </p>
        {chores.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Inga sysslor än.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {chores.map((c) => (
              <form key={c.id} action={() => onDo(c)}>
                <button
                  type="submit"
                  className="flex w-full flex-col items-center gap-1 rounded-2xl border border-border bg-card p-4 text-center transition hover:bg-muted active:scale-95"
                >
                  <span className="text-3xl">{c.icon ?? "✅"}</span>
                  <span className="text-sm font-medium">{c.name}</span>
                  {flash === c.id ? (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      ✓ Bra jobbat!
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      🎮 {formatMinutes(c.reward_minutes)}
                      {c.approval_mode !== "auto" ? " · väntar ok" : ""}
                    </span>
                  )}
                </button>
              </form>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Senaste</h2>
        {ledger.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Inget än — gör en syssla!</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {ledger.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {KIND_LABEL[e.kind] ?? e.kind}
                  {e.note ? <span className="text-muted-foreground"> · {e.note}</span> : null}
                </span>
                <span
                  className={`font-medium tabular-nums ${
                    e.delta_minutes >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                  }`}
                >
                  {e.delta_minutes >= 0 ? "+" : ""}
                  {e.delta_minutes} min
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
