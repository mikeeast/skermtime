import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveFamilyId } from "@/lib/family/server";
import { signOut } from "./actions";
import { Children } from "./children";
import { CreateFamily } from "./create-family";
import { ThemeToggle } from "@/components/theme-toggle";

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

  const activeFamilyId = await getActiveFamilyId(supabase);
  const { data: family } = activeFamilyId
    ? await supabase
        .from("families")
        .select("id, name, trial_ends_at, plan_status")
        .eq("id", activeFamilyId)
        .single()
    : { data: null };

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
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <form action={signOut}>
            <button className="text-sm text-muted-foreground transition hover:text-foreground">
              Logga ut
            </button>
          </form>
        </div>
      </header>

      {!family ? (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Skapa din familj</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Första steget — sedan kan du lägga till barn.
          </p>
          <CreateFamily />
        </section>
      ) : (
        <section className="flex flex-col gap-6">
          <nav className="flex gap-4 text-sm">
            <span className="font-medium">Översikt</span>
            <Link
              href="/dashboard/chores"
              className="text-muted-foreground transition hover:text-foreground"
            >
              Sysslor
            </Link>
            <Link
              href="/dashboard/approvals"
              className="text-muted-foreground transition hover:text-foreground"
            >
              Godkännanden
            </Link>
            <Link
              href="/dashboard/billing"
              className="text-muted-foreground transition hover:text-foreground"
            >
              Abonnemang
            </Link>
            <Link
              href="/dashboard/family"
              className="text-muted-foreground transition hover:text-foreground"
            >
              Familj
            </Link>
          </nav>
          {!["trialing", "active"].includes(family.plan_status as string) && (
            <Link
              href="/dashboard/billing"
              className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 transition hover:bg-red-500/15 dark:text-red-400"
            >
              Abonnemanget är inte aktivt — aktivera för att fortsätta använda Skermtime.
            </Link>
          )}
          <div>
            <h2 className="text-lg font-semibold">{family.name}</h2>
            <p className="text-sm text-muted-foreground">
              Provperiod till {new Date(family.trial_ends_at).toLocaleDateString("sv-SE")}
            </p>
          </div>

          <Children initial={children} />
        </section>
      )}
    </main>
  );
}
