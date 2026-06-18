import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChildPanel } from "./child-panel";

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

export default async function ChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: child } = await supabase
    .from("child_profiles")
    .select("id, alias, icon, balance_minutes")
    .eq("id", id)
    .single();
  if (!child) notFound();

  const { data: ledgerData } = await supabase
    .from("ledger_entries")
    .select("id, delta_minutes, kind, note, created_at")
    .eq("child_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: devicesData } = await supabase
    .from("devices")
    .select("id, name, paired, pairing_code, revoked, last_seen_at")
    .eq("child_id", id)
    .order("created_at");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <nav className="mb-8 text-sm">
        <Link href="/dashboard" className="text-gray-500 hover:underline">
          ← Översikt
        </Link>
      </nav>

      <ChildPanel
        childId={child.id}
        alias={child.alias}
        icon={child.icon}
        initialBalance={child.balance_minutes}
        initialLedger={(ledgerData ?? []) as LedgerEntry[]}
        initialDevices={(devicesData ?? []) as DeviceRow[]}
      />
    </main>
  );
}
