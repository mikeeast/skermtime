"use client";

import { useOptimistic, useRef } from "react";
import {
  activateLibraryChore,
  createChore,
  deleteChore,
  markChoreDone,
  setChoreReward,
} from "../chore-actions";
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

type Action =
  | { type: "add"; chore: Chore }
  | { type: "remove"; id: string }
  | { type: "update"; id: string; reward: number; duration: number };

export function ChoresManager({
  initialFamily,
  library,
  kids,
}: {
  initialFamily: Chore[];
  library: Chore[];
  kids: Child[];
}) {
  const [chores, dispatch] = useOptimistic(initialFamily, (state: Chore[], a: Action) => {
    switch (a.type) {
      case "add":
        return [...state, a.chore];
      case "remove":
        return state.filter((c) => c.id !== a.id);
      case "update":
        return state.map((c) =>
          c.id === a.id ? { ...c, reward_minutes: a.reward, duration_minutes: a.duration } : c,
        );
    }
  });
  const [marked, addMarked] = useOptimistic<string[], string>([], (s, id) => [...s, id]);
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

  async function onUpdate(formData: FormData) {
    const id = String(formData.get("choreId") ?? "");
    const reward = Number(formData.get("reward"));
    const duration = Number(formData.get("duration"));
    if (id && Number.isFinite(reward) && Number.isFinite(duration)) {
      dispatch({
        type: "update",
        id,
        reward: Math.max(0, Math.trunc(reward)),
        duration: Math.max(0, Math.trunc(duration)),
      });
    }
    await setChoreReward(formData);
  }

  async function onDelete(id: string) {
    dispatch({ type: "remove", id });
    const fd = new FormData();
    fd.set("choreId", id);
    await deleteChore(fd);
  }

  async function onMarkDone(formData: FormData) {
    addMarked(String(formData.get("choreId") ?? ""));
    await markChoreDone(formData);
  }

  return (
    <>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Familjens sysslor</h2>
        {chores.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            Inga ännu — lägg till från biblioteket nedan eller skapa en egen.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {chores.map((c) => (
              <li key={c.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    {c.category} · {APPROVAL_LABEL[c.approval_mode] ?? c.approval_mode}
                  </span>
                  {marked.includes(c.id) && (
                    <span className="text-xs font-medium text-green-600">✓ Skickad!</span>
                  )}
                </div>

                <form action={onUpdate} className="flex flex-wrap items-center gap-2 text-sm">
                  <input type="hidden" name="choreId" value={c.id} />
                  <span className="text-gray-500">⏱ utför</span>
                  <input
                    name="duration"
                    type="number"
                    min={0}
                    defaultValue={c.duration_minutes}
                    key={`d${c.duration_minutes}`}
                    className="h-8 w-16 rounded border border-gray-300 px-2 text-right"
                  />
                  <span className="text-gray-400">min</span>
                  <span className="text-gray-400">→ 🎮</span>
                  <input
                    name="reward"
                    type="number"
                    min={0}
                    defaultValue={c.reward_minutes}
                    key={`r${c.reward_minutes}`}
                    className="h-8 w-20 rounded border border-gray-300 px-2 text-right"
                  />
                  <span className="text-gray-400">min ({formatMinutes(c.reward_minutes)})</span>
                  <button className="h-8 rounded bg-gray-900 px-3 text-xs font-medium text-white">
                    Spara
                  </button>
                </form>

                <div className="flex flex-wrap items-center gap-2">
                  {kids.length > 0 && (
                    <form action={onMarkDone} className="flex items-center gap-1">
                      <input type="hidden" name="choreId" value={c.id} />
                      <select
                        name="childId"
                        className="h-8 rounded border border-gray-300 px-1 text-sm"
                      >
                        {kids.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.alias}
                          </option>
                        ))}
                      </select>
                      <button className="h-8 rounded bg-green-600 px-3 text-xs font-medium text-white">
                        Klar ✓
                      </button>
                    </form>
                  )}
                  <form action={() => onDelete(c.id)} className="ml-auto">
                    <button className="h-8 px-1 text-xs text-gray-400 hover:text-red-600">
                      Ta bort
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-semibold">Skapa egen syssla</h2>
        <form ref={createRef} action={onCreate} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs text-gray-500">
            Namn
            <input
              name="name"
              required
              className="mt-1 h-9 w-48 rounded border border-gray-300 px-2 text-sm text-gray-900"
            />
          </label>
          <label className="flex flex-col text-xs text-gray-500">
            Kategori
            <input
              name="category"
              placeholder="Eget"
              className="mt-1 h-9 w-32 rounded border border-gray-300 px-2 text-sm text-gray-900"
            />
          </label>
          <label className="flex flex-col text-xs text-gray-500">
            Utförandetid (min)
            <input
              name="duration"
              type="number"
              min={0}
              defaultValue={10}
              className="mt-1 h-9 w-24 rounded border border-gray-300 px-2 text-sm text-gray-900"
            />
          </label>
          <label className="flex flex-col text-xs text-gray-500">
            Skärmtid (min)
            <input
              name="reward"
              type="number"
              min={0}
              defaultValue={30}
              className="mt-1 h-9 w-24 rounded border border-gray-300 px-2 text-sm text-gray-900"
            />
          </label>
          <label className="flex flex-col text-xs text-gray-500">
            Godkännande
            <select
              name="approval"
              className="mt-1 h-9 rounded border border-gray-300 px-2 text-sm text-gray-900"
            >
              <option value="parent">förälder</option>
              <option value="auto">auto</option>
              <option value="ai">AI-foto</option>
            </select>
          </label>
          <button className="h-9 rounded-lg bg-black px-4 text-sm font-medium text-white">
            Lägg till
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Bibliotek</h2>
        <p className="mt-1 text-sm text-gray-500">
          Lägg till färdiga sysslor med vettiga standardvärden.
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {library.map((c) => {
            const already = activeKey.has(`${c.category}|${c.name}`);
            return (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <span className="truncate">
                  {c.icon ? `${c.icon} ` : ""}
                  {c.name}
                </span>
                <span className="whitespace-nowrap text-xs text-gray-400">
                  ⏱ {c.duration_minutes}→🎮 {formatMinutes(c.reward_minutes)}
                </span>
                <form action={() => onActivate(c)} className="ml-auto">
                  <button
                    disabled={already}
                    className="rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    {already ? "Tillagd" : "Lägg till"}
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
