import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ApprovalsList, type Pending } from "./approvals-list";
import { ThemeToggle } from "@/components/theme-toggle";

type Row = {
  id: string;
  ai_verdict: { done?: boolean; confidence?: number; reason?: string } | null;
  chores: { name: string; icon: string | null; reward_minutes: number } | null;
  child_profiles: { alias: string } | null;
};

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: fams } = await supabase.from("families").select("id").limit(1);
  const family = fams?.[0];
  if (!family) redirect("/dashboard");

  const { data } = await supabase
    .from("chore_completions")
    .select("id, ai_verdict, chores(name, icon, reward_minutes), child_profiles(alias)")
    .eq("family_id", family.id)
    .eq("status", "pending")
    .order("created_at");

  const rows = (data ?? []) as unknown as Row[];
  const pending: Pending[] = rows.map((p) => ({
    id: p.id,
    ai_verdict: p.ai_verdict,
    chore_name: p.chores?.name ?? "Syssla",
    chore_icon: p.chores?.icon ?? null,
    reward_minutes: p.chores?.reward_minutes ?? 0,
    child_alias: p.child_profiles?.alias ?? "",
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <nav className="flex gap-4 text-sm">
          <Link href="/dashboard" className="text-muted-foreground transition hover:text-foreground">
            ← Översikt
          </Link>
          <Link
            href="/dashboard/chores"
            className="text-muted-foreground transition hover:text-foreground"
          >
            Sysslor
          </Link>
          <span className="font-medium">Godkännanden</span>
        </nav>
        <ThemeToggle />
      </div>

      <h1 className="text-2xl font-bold">Att godkänna</h1>
      <ApprovalsList initial={pending} />
    </main>
  );
}
