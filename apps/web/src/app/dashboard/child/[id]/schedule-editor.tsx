"use client";

import { useOptimistic, useRef } from "react";
import {
  createLockSchedule,
  deleteLockSchedule,
  setDailyScreenCap,
} from "../../schedule-actions";

export type Schedule = {
  id: string;
  label: string;
  days: number[];
  start_min: number;
  end_min: number;
};

const DAY_LABELS = ["", "Må", "Ti", "On", "To", "Fr", "Lö", "Sö"];

function minToHHMM(m: number): string {
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}
function hhmmToMin(s: string): number {
  const [h, mi] = s.split(":").map(Number);
  return h * 60 + mi;
}

export function ScheduleEditor({
  childId,
  initialSchedules,
  dailyCap,
}: {
  childId: string;
  initialSchedules: Schedule[];
  dailyCap: number | null;
}) {
  const [schedules, dispatch] = useOptimistic(
    initialSchedules,
    (state: Schedule[], a: { type: "add"; s: Schedule } | { type: "remove"; id: string }) =>
      a.type === "add" ? [...state, a.s] : state.filter((s) => s.id !== a.id),
  );
  const formRef = useRef<HTMLFormElement>(null);

  async function onAdd(fd: FormData) {
    const days = (fd.getAll("days") as string[]).map(Number);
    const start = String(fd.get("start") ?? "");
    const end = String(fd.get("end") ?? "");
    if (days.length === 0 || !start || !end) return;
    dispatch({
      type: "add",
      s: {
        id: `temp-${crypto.randomUUID()}`,
        label: String(fd.get("label") || "Läggdags"),
        days,
        start_min: hhmmToMin(start),
        end_min: hhmmToMin(end),
      },
    });
    formRef.current?.reset();
    fd.set("childId", childId);
    await createLockSchedule(fd);
  }

  async function onRemove(id: string) {
    dispatch({ type: "remove", id });
    const fd = new FormData();
    fd.set("scheduleId", id);
    fd.set("childId", childId);
    await deleteLockSchedule(fd);
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Schema-lås (läggdags)</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Datorn låses under dessa tider oavsett saldo.
      </p>

      {schedules.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {schedules.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-2 text-sm"
            >
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground">
                {s.days
                  .slice()
                  .sort((a, b) => a - b)
                  .map((d) => DAY_LABELS[d])
                  .join(" ")}{" "}
                · {minToHHMM(s.start_min)}–{minToHHMM(s.end_min)}
              </span>
              <form action={() => onRemove(s.id)} className="ml-auto">
                <button className="text-xs text-muted-foreground transition hover:text-red-500">
                  Ta bort
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={onAdd} className="mt-3 flex flex-col gap-2">
        <input
          name="label"
          placeholder="Namn (t.ex. Läggdags)"
          className="h-9 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />
        <div className="flex flex-wrap gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <label
              key={d}
              className="flex cursor-pointer items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs"
            >
              <input type="checkbox" name="days" value={d} defaultChecked={d <= 4} />
              {DAY_LABELS[d]}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex flex-col text-xs text-muted-foreground">
            Från
            <input
              name="start"
              type="time"
              defaultValue="21:00"
              className="h-9 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </label>
          <label className="flex flex-col text-xs text-muted-foreground">
            Till
            <input
              name="end"
              type="time"
              defaultValue="07:00"
              className="h-9 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </label>
          <button className="mt-auto h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            Lägg till
          </button>
        </div>
      </form>

      <form
        action={setDailyScreenCap}
        className="mt-4 flex items-end gap-2 border-t border-border pt-4"
      >
        <input type="hidden" name="childId" value={childId} />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Max skärmtid per dag (min)
          <input
            name="cap"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={dailyCap ?? ""}
            placeholder="Inget tak"
            className="h-9 w-32 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
        </label>
        <button className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">
          Spara
        </button>
      </form>
    </section>
  );
}
