import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChildPanel } from "./child-panel";
import { ThemeToggle } from "@/components/theme-toggle";

type LedgerEntry = {
  id: string;
  delta_minutes: number;
  kind: string;
  note: string | null;
  created_at: string;
};
type DeviceRow = {
  id: string;
  name: string;
  paired: boolean;
  pairing_code: string | null;
  revoked: boolean;
  last_seen_at: string | null;
};
type ChoreOpt = {
  id: string;
  name: string;
  icon: string | null;
  reward_minutes: number;
  approval_mode: string;
};

export default async function ChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: child } = await supabase
    .from("child_profiles")
    .select("id, alias, icon, balance_minutes, family_id")
    .eq("id", id)
    .single();
  if (!child) notFound();

  const [ledgerRes, devicesRes, choresRes] = await Promise.all([
    supabase
      .from("ledger_entries")
      .select("id, delta_minutes, kind, note, created_at")
      .eq("child_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("devices")
      .select("id, name, paired, pairing_code, revoked, last_seen_at")
      .eq("child_id", id)
      .order("created_at"),
    supabase
      .from("chores")
      .select("id, name, icon, reward_minutes, approval_mode")
      .eq("family_id", child.family_id)
      .eq("active", true)
      .order("category"),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <nav className="text-sm">
          <Link href="/dashboard" className="text-muted-foreground transition hover:text-foreground">
            ← Översikt
          </Link>
        </nav>
        <ThemeToggle />
      </div>

      <ChildPanel
        childId={child.id}
        alias={child.alias}
        icon={child.icon}
        initialBalance={child.balance_minutes}
        initialLedger={(ledgerRes.data ?? []) as LedgerEntry[]}
        initialDevices={(devicesRes.data ?? []) as DeviceRow[]}
        chores={(choresRes.data ?? []) as ChoreOpt[]}
      />
    </main>
  );
}
