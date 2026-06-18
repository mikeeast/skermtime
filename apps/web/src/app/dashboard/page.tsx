import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { Children } from "./children";
import { CreateFamily } from "./create-family";

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
    <main className="mx-auto max-w-4xl px-6 py-10">
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
          <CreateFamily />
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
              Provperiod till {new Date(family.trial_ends_at).toLocaleDateString("sv-SE")}
            </p>
          </div>

          <Children initial={children} />
        </section>
      )}
    </main>
  );
}
