"use client";

import { useRef, useState } from "react";
import { Check, Minus, Plus, Trash2 } from "lucide-react";
import { markChoreDone, setChoreReward } from "../chore-actions";
import { formatMinutes } from "@/lib/earning/format";

type Chore = {
  id: string;
  category: string;
  name: string;
  icon: string | null;
  reward_minutes: number;
  duration_minutes: number;
  approval_mode: string;
};
type Child = { id: string; alias: string };

const APPROVAL_LABEL: Record<string, string> = {
  auto: "auto",
  parent: "förälder",
  ai: "AI-foto",
};

const stepBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted active:scale-95 disabled:opacity-40";

function Stepper({
  value,
  step,
  onChange,
  label,
  ariaLabel,
}: {
  value: number;
  step: number;
  onChange: (next: number) => void;
  label: string;
  ariaLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`Minska ${ariaLabel}`}
        disabled={value <= 0}
        onClick={() => onChange(value - step)}
        className={stepBtn}
      >
        <Minus size={15} />
      </button>
      <span className="min-w-16 text-center text-sm font-medium tabular-nums">{label}</span>
      <button
        type="button"
        aria-label={`Öka ${ariaLabel}`}
        onClick={() => onChange(value + step)}
        className={stepBtn}
      >
        <Plus size={15} />
      </button>
    </span>
  );
}

export function ChoreCard({
  chore,
  kids,
  onDelete,
}: {
  chore: Chore;
  kids: Child[];
  onDelete: (id: string) => Promise<void>;
}) {
  const [duration, setDuration] = useState(chore.duration_minutes);
  const [reward, setReward] = useState(chore.reward_minutes);
  const [sent, setSent] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save (debounced) — no explicit save button.
  function persist(d: number, r: number) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("choreId", chore.id);
      fd.set("duration", String(d));
      fd.set("reward", String(r));
      void setChoreReward(fd);
    }, 500);
  }

  function changeDuration(next: number) {
    const v = Math.max(0, next);
    setDuration(v);
    persist(v, reward);
  }
  function changeReward(next: number) {
    const v = Math.max(0, next);
    setReward(v);
    persist(duration, v);
  }

  async function onMarkDone(formData: FormData) {
    setSent(true);
    setTimeout(() => setSent(false), 2500);
    await markChoreDone(formData);
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">
          {chore.icon ? `${chore.icon} ` : ""}
          {chore.name}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {chore.category} · {APPROVAL_LABEL[chore.approval_mode] ?? chore.approval_mode}
        </span>
        {sent && (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            ✓ Skickad!
          </span>
        )}
        <form action={() => onDelete(chore.id)} className="ml-auto">
          <button
            type="submit"
            aria-label="Ta bort syssla"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500"
          >
            <Trash2 size={16} />
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="text-muted-foreground">⏱ utför</span>
        <Stepper
          value={duration}
          step={5}
          onChange={changeDuration}
          label={`${duration} min`}
          ariaLabel="utförandetid"
        />
        <span className="text-muted-foreground">→ 🎮</span>
        <Stepper
          value={reward}
          step={15}
          onChange={changeReward}
          label={formatMinutes(reward)}
          ariaLabel="skärmtid"
        />
      </div>

      {kids.length > 0 && (
        <form action={onMarkDone} className="flex items-center gap-2">
          <input type="hidden" name="choreId" value={chore.id} />
          <select
            name="childId"
            className="h-9 flex-1 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          >
            {kids.map((k) => (
              <option key={k.id} value={k.id}>
                {k.alias}
              </option>
            ))}
          </select>
          <button
            type="submit"
            aria-label="Markera som klar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-700"
          >
            <Check size={18} />
          </button>
        </form>
      )}
    </li>
  );
}
