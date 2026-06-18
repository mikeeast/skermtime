import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChoresManager } from "./chores-manager";
import { ThemeToggle } from "@/components/theme-toggle";

type Chore = {
  id: string;
  category: string;
  name: string;
  icon: string | null;
  reward_minutes: number;
  duration_minutes: number;
  approval_mode: string;
};

export default async function ChoresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: fams } = await supabase.from("families").select("id").limit(1);
  const family = fams?.[0];
  if (!family) redirect("/dashboard");

  const sel = "id, category, name, icon, reward_minutes, duration_minutes, approval_mode";
  const [familyChoresRes, libraryRes] = await Promise.all([
    supabase.from("chores").select(sel).eq("family_id", family.id).order("category"),
    supabase.from("chores").select(sel).is("family_id", null).order("category"),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <nav className="flex gap-4 text-sm">
          <Link href="/dashboard" className="text-muted-foreground transition hover:text-foreground">
            ← Översikt
          </Link>
          <span className="font-medium">Sysslor</span>
          <Link
            href="/dashboard/approvals"
            className="text-muted-foreground transition hover:text-foreground"
          >
            Godkännanden
          </Link>
        </nav>
        <ThemeToggle />
      </div>

      <h1 className="text-2xl font-bold">Sysslor</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Hantera familjens syssel-katalog. Avbockning sker på respektive barns sida.
      </p>

      <ChoresManager
        initialFamily={(familyChoresRes.data ?? []) as Chore[]}
        library={(libraryRes.data ?? []) as Chore[]}
      />
    </main>
  );
}
