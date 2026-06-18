"use client";

import { useOptimistic, useRef } from "react";
import Link from "next/link";
import { addChild } from "./actions";

type Child = {
  id: string;
  alias: string;
  icon: string | null;
  balance_minutes: number;
};

export function Children({ initial }: { initial: Child[] }) {
  const [children, addOptimistic] = useOptimistic(
    initial,
    (state: Child[], next: Child) => [...state, next],
  );
  const formRef = useRef<HTMLFormElement>(null);

  async function action(formData: FormData) {
    const alias = String(formData.get("alias") ?? "").trim();
    if (!alias) return;
    const icon = String(formData.get("icon") ?? "").trim() || null;
    addOptimistic({ id: `temp-${crypto.randomUUID()}`, alias, icon, balance_minutes: 0 });
    formRef.current?.reset();
    await addChild(formData);
  }

  return (
    <div className="flex flex-col gap-2">
      {children.length === 0 ? (
        <p className="text-sm text-gray-500">Inga barn tillagda än.</p>
      ) : (
        children.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/child/${c.id}`}
            className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50"
          >
            <span className="font-medium">
              {c.icon ? `${c.icon} ` : ""}
              {c.alias}
            </span>
            <span className="text-sm text-gray-500">{c.balance_minutes} min</span>
          </Link>
        ))
      )}

      <form ref={formRef} action={action} className="flex gap-3">
        <input
          name="icon"
          placeholder="🙂"
          maxLength={2}
          className="h-11 w-14 rounded-lg border border-gray-300 text-center"
        />
        <input
          name="alias"
          required
          placeholder="Barnets alias"
          className="h-11 flex-1 rounded-lg border border-gray-300 px-3"
        />
        <button className="h-11 rounded-lg bg-black px-5 font-medium text-white">Lägg till</button>
      </form>
    </div>
  );
}
