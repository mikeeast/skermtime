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
type StravaConnection = {
  id: string;
  athlete_id: number;
  scope: string | null;
  created_at: string;
};
type RunRow = {
  id: string;
  type: string | null;
  distance_m: number;
  moving_time_s: number | null;
  started_at: string;
  minutes_awarded: number;
};

export default async function ChildPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ strava?: string }>;
}) {
  const { id } = await params;
  const { strava } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: child } = await supabase
    .from("child_profiles")
    .select("id, alias, icon, balance_minutes, family_id, login_code")
    .eq("id", id)
    .single();
  if (!child) notFound();

  const [ledgerRes, devicesRes, choresRes, stravaConnRes, runsRes, familyRes] =
    await Promise.all([
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
        .order("category")
        .order("created_at")
        .order("id"),
      // Never select tokens into the client.
      supabase
        .from("strava_connections")
        .select("id, athlete_id, scope, created_at")
        .eq("child_id", id)
        .maybeSingle(),
      supabase
        .from("strava_activities")
        .select("id, type, distance_m, moving_time_s, started_at, minutes_awarded")
        .eq("child_id", id)
        .order("started_at", { ascending: false })
        .limit(5),
      supabase
        .from("families")
        .select("strava_minutes_per_km, daily_cap_minutes")
        .eq("id", child.family_id)
        .single(),
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
        loginCode={child.login_code}
        initialBalance={child.balance_minutes}
        initialLedger={(ledgerRes.data ?? []) as LedgerEntry[]}
        initialDevices={(devicesRes.data ?? []) as DeviceRow[]}
        chores={(choresRes.data ?? []) as ChoreOpt[]}
        stravaConnection={(stravaConnRes.data ?? null) as StravaConnection | null}
        recentRuns={(runsRes.data ?? []) as RunRow[]}
        familyEarning={{
          minutesPerKm: familyRes.data?.strava_minutes_per_km ?? 10,
          dailyCap: familyRes.data?.daily_cap_minutes ?? null,
        }}
        stravaStatus={strava === "connected" ? "connected" : strava === "error" ? "error" : undefined}
      />
    </main>
  );
}
