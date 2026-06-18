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
        className="h-11 flex-1 rounded-lg border border-gray-300 px-3"
      />
      <button
        disabled={pending}
        className="h-11 rounded-lg bg-black px-5 font-medium text-white disabled:opacity-50"
      >
        {pending ? "Skapar…" : "Skapa"}
      </button>
    </form>
  );
}
