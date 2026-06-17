import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addChild, createFamily, signOut } from "./actions";

type Child = {
  id: string;
  alias: string;
  icon: string | null;
  balance_minutes: number;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: families } = await supabase
    .from("families")
    .select("id, name, trial_ends_at, plan_status")
    .limit(1);
  const family = families?.[0];

  let children: Child[] = [];
  if (family) {
    const { data } = await supabase
      .from("child_profiles")
      .select("id, alias, icon, balance_minutes")
      .eq("family_id", family.id)
      .order("created_at");
    children = data ?? [];
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Skermtime</h1>
        <form action={signOut}>
          <button className="text-sm text-gray-500 hover:underline">Logga ut</button>
        </form>
      </header>

      {!family ? (
        <section className="rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold">Skapa din familj</h2>
          <p className="mt-1 text-sm text-gray-500">
            Första steget — sedan kan du lägga till barn.
          </p>
          <form action={createFamily} className="mt-4 flex gap-3">
            <input
              name="name"
              required
              placeholder="Familjenamn"
              className="h-11 flex-1 rounded-lg border border-gray-300 px-3"
            />
            <button className="h-11 rounded-lg bg-black px-5 font-medium text-white">
              Skapa
            </button>
          </form>
        </section>
      ) : (
        <section className="flex flex-col gap-6">
          <nav className="flex gap-4 text-sm">
            <span className="font-medium">Översikt</span>
            <Link href="/dashboard/chores" className="text-gray-500 hover:underline">
              Sysslor
            </Link>
            <Link href="/dashboard/approvals" className="text-gray-500 hover:underline">
              Godkännanden
            </Link>
            <Link href="/dashboard/billing" className="text-gray-500 hover:underline">
              Abonnemang
            </Link>
          </nav>
          {!["trialing", "active"].includes(family.plan_status as string) && (
            <Link
              href="/dashboard/billing"
              className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 hover:bg-red-100"
            >
              Abonnemanget är inte aktivt — aktivera för att fortsätta använda Skermtime.
            </Link>
          )}
          <div>
            <h2 className="text-lg font-semibold">{family.name}</h2>
            <p className="text-sm text-gray-500">
              Provperiod till{" "}
              {new Date(family.trial_ends_at).toLocaleDateString("sv-SE")}
            </p>
          </div>

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
          </div>

          <form action={addChild} className="flex gap-3">
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
            <button className="h-11 rounded-lg bg-black px-5 font-medium text-white">
              Lägg till
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
