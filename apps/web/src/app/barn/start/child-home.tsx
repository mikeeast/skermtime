"use client";

import { useOptimistic, useRef, useState } from "react";
import { logChore } from "../actions";
import { formatMinutes } from "@/lib/earning/format";
import { compressImage } from "@/lib/image/compress";
import { Mascot } from "@/components/mascot";

type ChoreOpt = {
  id: string;
  name: string;
  icon: string | null;
  reward_minutes: number;
  approval_mode: string;
  frequency: string;
};
type LedgerEntry = {
  id: string;
  delta_minutes: number;
  kind: string;
  note: string | null;
  created_at: string;
};
export type BadgeView = {
  id: string;
  name: string;
  icon: string;
  description: string;
  earned: boolean;
};

const KIND_LABEL: Record<string, string> = {
  earn_chore: "Syssla",
  earn_strava: "Löprunda",
  spend: "Förbrukad",
  adjust: "Justering",
  bounty: "Bonus",
  clawback: "Återtag",
  streak_bonus: "Svitbonus 🔥",
};

const RECURRING = new Set(["daily", "weekly"]);

export function ChildHome({
  initialBalance,
  chores,
  ledger,
  stravaConnected,
  streak = 0,
  doneChoreIds = [],
  badges = [],
}: {
  initialBalance: number;
  chores: ChoreOpt[];
  ledger: LedgerEntry[];
  stravaConnected?: boolean;
  streak?: number;
  doneChoreIds?: string[];
  badges?: BadgeView[];
}) {
  const [balance, addBalance] = useOptimistic(initialBalance, (b: number, delta: number) => b + delta);
  const [flash, setFlash] = useState<string | null>(null);
  // Locally track which recurring chores are done this period (optimistic).
  const [done, setDone] = useState<Set<string>>(() => new Set(doneChoreIds));

  // AI-photo capture state.
  const [aiChore, setAiChore] = useState<ChoreOpt | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  function markDone(c: ChoreOpt) {
    if (RECURRING.has(c.frequency)) setDone((cur) => new Set(cur).add(c.id));
  }

  async function onDo(c: ChoreOpt) {
    if (c.approval_mode === "auto") addBalance(c.reward_minutes);
    markDone(c);
    setFlash(c.id);
    setTimeout(() => setFlash((cur) => (cur === c.id ? null : cur)), 2000);
    const fd = new FormData();
    fd.set("choreId", c.id);
    await logChore(fd);
  }

  async function uploadPhoto(file: File, slot: "before" | "after", completionId: string) {
    const blob = await compressImage(file);
    const fd = new FormData();
    fd.set("file", new File([blob], `${slot}.jpg`, { type: "image/jpeg" }));
    fd.set("slot", slot);
    fd.set("completionId", completionId);
    const res = await fetch("/api/barn/chore-photo", { method: "POST", body: fd });
    if (!res.ok) return null;
    const json = (await res.json()) as { path?: string };
    return json.path ?? null;
  }

  async function submitAiChore() {
    const c = aiChore;
    if (!c) return;
    const afterFile = afterRef.current?.files?.[0];
    if (!afterFile) {
      setPhotoError("Ta en bild på resultatet först.");
      return;
    }
    const beforeFile = beforeRef.current?.files?.[0] ?? null;
    setUploading(true);
    setPhotoError(null);
    try {
      const completionId = crypto.randomUUID();
      const afterPath = await uploadPhoto(afterFile, "after", completionId);
      if (!afterPath) throw new Error("upload");
      const beforePath = beforeFile ? await uploadPhoto(beforeFile, "before", completionId) : null;

      const fd = new FormData();
      fd.set("choreId", c.id);
      fd.set("completionId", completionId);
      if (beforePath) fd.set("beforeUrl", beforePath);
      fd.set("afterUrl", afterPath);
      await logChore(fd);

      markDone(c);
      setReviewMsg(`📷 ${c.name} skickad för granskning!`);
      setTimeout(() => setReviewMsg(null), 4000);
      setAiChore(null);
    } catch {
      setPhotoError("Kunde inte ladda upp bilden — försök igen.");
    } finally {
      setUploading(false);
    }
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

      {streak > 0 && (
        <p className="mt-3 rounded-2xl bg-amber-500/10 px-4 py-3 text-center text-sm font-semibold text-amber-700 dark:text-amber-300">
          🔥 {streak} {streak === 1 ? "dag" : "dagar"} i rad!
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Mina sysslor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tryck när du gjort något — så tjänar du tid!
        </p>
        {reviewMsg && (
          <p className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {reviewMsg}
          </p>
        )}
        {chores.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Inga sysslor än.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {chores.map((c) =>
              done.has(c.id) ? (
                <div
                  key={c.id}
                  className="flex w-full flex-col items-center gap-1 rounded-2xl border border-border bg-muted/50 p-4 text-center opacity-70"
                >
                  <span className="text-3xl">{c.icon ?? "✅"}</span>
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    ✓ Klar
                  </span>
                </div>
              ) : c.approval_mode === "ai" ? (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setPhotoError(null);
                    setAiChore(c);
                  }}
                  className="flex w-full flex-col items-center gap-1 rounded-2xl border border-border bg-card p-4 text-center transition hover:bg-muted active:scale-95"
                >
                  <span className="text-3xl">{c.icon ?? "✅"}</span>
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    📷 {formatMinutes(c.reward_minutes)} · foto
                  </span>
                </button>
              ) : (
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
              ),
            )}
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

      {badges.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Märken</h2>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {badges.map((b) => (
              <div
                key={b.id}
                title={b.description}
                className={`flex flex-col items-center gap-1 rounded-2xl border border-border p-3 text-center ${
                  b.earned ? "bg-card" : "bg-muted/40 opacity-40 grayscale"
                }`}
              >
                <span className="text-3xl">{b.icon}</span>
                <span className="text-[11px] font-medium leading-tight">{b.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {aiChore && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">
              {aiChore.icon ? `${aiChore.icon} ` : ""}
              {aiChore.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Ta en bild så kollar en robot att det är gjort. 📷
            </p>

            <label className="mt-4 block text-sm font-medium">Före (valfri)</label>
            <input
              ref={beforeRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="mt-1 block w-full text-sm"
            />
            <label className="mt-3 block text-sm font-medium">Efter</label>
            <input
              ref={afterRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="mt-1 block w-full text-sm"
            />

            {photoError && <p className="mt-2 text-sm text-red-500">{photoError}</p>}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={submitAiChore}
                disabled={uploading}
                className="h-11 flex-1 rounded-xl bg-primary font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? "Laddar upp…" : "Skicka för granskning"}
              </button>
              <button
                type="button"
                onClick={() => setAiChore(null)}
                disabled={uploading}
                className="h-11 rounded-xl border border-border px-4 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
