"use client";

import { useOptimistic, useRef } from "react";
import { Check, Plus } from "lucide-react";
import { activateLibraryChore, createChore, deleteChore } from "../chore-actions";
import { formatMinutes } from "@/lib/earning/format";
import { ChoreCard } from "./chore-card";

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

type Action = { type: "add"; chore: Chore } | { type: "remove"; id: string };

export function ChoresManager({
  initialFamily,
  library,
  kids,
}: {
  initialFamily: Chore[];
  library: Chore[];
  kids: Child[];
}) {
  const [chores, dispatch] = useOptimistic(initialFamily, (state: Chore[], a: Action) =>
    a.type === "add" ? [...state, a.chore] : state.filter((c) => c.id !== a.id),
  );
  const createRef = useRef<HTMLFormElement>(null);

  const activeKey = new Set(chores.map((c) => `${c.category}|${c.name}`));

  async function onCreate(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    const category = String(formData.get("category") ?? "").trim() || "Eget";
    const reward = Number(formData.get("reward"));
    const duration = Number(formData.get("duration"));
    const approval = String(formData.get("approval") ?? "parent");
    dispatch({
      type: "add",
      chore: {
        id: `temp-${crypto.randomUUID()}`,
        category,
        name,
        icon: null,
        reward_minutes: Number.isFinite(reward) ? Math.max(0, Math.trunc(reward)) : 30,
        duration_minutes: Number.isFinite(duration) ? Math.max(0, Math.trunc(duration)) : 10,
        approval_mode: approval,
      },
    });
    createRef.current?.reset();
    await createChore(formData);
  }

  async function onActivate(lib: Chore) {
    dispatch({ type: "add", chore: { ...lib, id: `temp-${crypto.randomUUID()}` } });
    const fd = new FormData();
    fd.set("choreId", lib.id);
    await activateLibraryChore(fd);
  }

  async function onDelete(id: string) {
    dispatch({ type: "remove", id });
    const fd = new FormData();
    fd.set("choreId", id);
    await deleteChore(fd);
  }

  return (
    <>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Familjens sysslor</h2>
        {chores.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Inga ännu — lägg till från biblioteket nedan eller skapa en egen.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {chores.map((c) => (
              <ChoreCard key={c.id} chore={c} kids={kids} onDelete={onDelete} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Skapa egen syssla</h2>
        <form ref={createRef} action={onCreate} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs text-muted-foreground">
            Namn
            <input
              name="name"
              required
              className="mt-1 h-9 w-48 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </label>
          <label className="flex flex-col text-xs text-muted-foreground">
            Kategori
            <input
              name="category"
              placeholder="Eget"
              className="mt-1 h-9 w-32 rounded-lg border border-border bg-card px-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
            />
          </label>
          <label className="flex flex-col text-xs text-muted-foreground">
            Utförandetid (min)
            <input
              name="duration"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={10}
              className="mt-1 h-9 w-24 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </label>
          <label className="flex flex-col text-xs text-muted-foreground">
            Skärmtid (min)
            <input
              name="reward"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={30}
              className="mt-1 h-9 w-24 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </label>
          <label className="flex flex-col text-xs text-muted-foreground">
            Godkännande
            <select
              name="approval"
              className="mt-1 h-9 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            >
              <option value="parent">förälder</option>
              <option value="auto">auto</option>
              <option value="ai">AI-foto</option>
            </select>
          </label>
          <button className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            Lägg till
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Bibliotek</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Lägg till färdiga sysslor med vettiga standardvärden.
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {library.map((c) => {
            const already = activeKey.has(`${c.category}|${c.name}`);
            return (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm"
              >
                <span className="truncate">
                  {c.icon ? `${c.icon} ` : ""}
                  {c.name}
                </span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  ⏱ {c.duration_minutes}→🎮 {formatMinutes(c.reward_minutes)}
                </span>
                <form action={() => onActivate(c)} className="ml-auto">
                  <button
                    disabled={already}
                    aria-label={already ? "Redan tillagd" : "Lägg till i familjen"}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                      already
                        ? "bg-muted text-muted-foreground"
                        : "bg-foreground text-background hover:opacity-90"
                    }`}
                  >
                    {already ? <Check size={16} /> : <Plus size={16} />}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
