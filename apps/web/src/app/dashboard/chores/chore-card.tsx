"use client";

import { useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { setChoreReward } from "../chore-actions";
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
  onDelete,
}: {
  chore: Chore;
  onDelete: (id: string) => Promise<void>;
}) {
  const [duration, setDuration] = useState(chore.duration_minutes);
  const [reward, setReward] = useState(chore.reward_minutes);
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
    </li>
  );
}
