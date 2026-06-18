import { redirect } from "next/navigation";
import { getChildId } from "@/lib/child/server";
import { childLogin } from "./actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Mascot } from "@/components/mascot";

export default async function BarnLogin({
  searchParams,
}: {
  searchParams: Promise<{ fel?: string }>;
}) {
  if (await getChildId()) redirect("/barn/start");
  const { fel } = await searchParams;

  return (
    <main className="relative mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="text-center">
        <Mascot className="mx-auto h-28 w-28" />
        <h1 className="mt-2 text-3xl font-bold">Skermtime</h1>
        <p className="mt-2 text-sm text-muted-foreground">Logga in med din kod och PIN.</p>
      </div>

      <form action={childLogin} className="flex flex-col gap-3">
        <input
          name="code"
          required
          autoCapitalize="characters"
          placeholder="Din kod"
          className="h-12 rounded-xl border border-border bg-card px-3 text-center text-lg font-semibold uppercase tracking-widest outline-none placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
        />
        <input
          name="pin"
          required
          inputMode="numeric"
          type="password"
          placeholder="PIN"
          className="h-12 rounded-xl border border-border bg-card px-3 text-center text-lg tracking-widest outline-none placeholder:tracking-normal placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
        />
        <button className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition hover:opacity-90">
          Logga in
        </button>
      </form>

      {fel && (
        <p className="text-center text-sm text-red-500">Fel kod eller PIN. Försök igen.</p>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Är du förälder?{" "}
        <a href="/login" className="underline">
          Logga in här
        </a>
        .
      </p>
    </main>
  );
}
