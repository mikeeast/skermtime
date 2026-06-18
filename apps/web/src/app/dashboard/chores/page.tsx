import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChoresManager } from "./chores-manager";

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
  const [familyChoresRes, libraryRes, childrenRes] = await Promise.all([
    supabase.from("chores").select(sel).eq("family_id", family.id).order("category"),
    supabase.from("chores").select(sel).is("family_id", null).order("category"),
    supabase
      .from("child_profiles")
      .select("id, alias")
      .eq("family_id", family.id)
      .order("created_at"),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <nav className="mb-8 flex gap-4 text-sm">
        <Link href="/dashboard" className="text-gray-500 hover:underline">
          ← Översikt
        </Link>
        <span className="font-medium">Sysslor</span>
        <Link href="/dashboard/approvals" className="text-gray-500 hover:underline">
          Godkännanden
        </Link>
      </nav>

      <h1 className="text-2xl font-bold">Sysslor</h1>

      <ChoresManager
        initialFamily={(familyChoresRes.data ?? []) as Chore[]}
        library={(libraryRes.data ?? []) as Chore[]}
        kids={(childrenRes.data ?? []) as Child[]}
      />
    </main>
  );
}
