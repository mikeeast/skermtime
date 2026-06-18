"use client";

import { useTransition } from "react";
import { createFamily } from "./actions";

export function CreateFamily() {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(formData) => startTransition(() => createFamily(formData))}
      className="mt-4 flex gap-3"
    >
      <input
        name="name"
        required
        placeholder="Familjenamn"
        className="h-11 flex-1 rounded-xl border border-border bg-card px-3 outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
      />
      <button
        disabled={pending}
        className="h-11 rounded-xl bg-primary px-5 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Skapar…" : "Skapa"}
      </button>
    </form>
  );
}
