import { redirect } from "next/navigation";
import { getChildId } from "@/lib/child/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { doneChoreIdsThisPeriod, familyTimezone } from "@/lib/earning/period";
import { ChildHome, type BadgeView } from "./child-home";
import { ThemeToggle } from "@/components/theme-toggle";
import { childLogout } from "../actions";

type ChoreOpt = {
  id: string;
  name: string;
  icon: string | null;
  reward_minutes: number;
  approval_mode: string;
  frequency: string;
};
type LedgerEntry = {
  id: string;
  delta_minutes: number;
  kind: string;
  note: string | null;
  created_at: string;
};

export default async function BarnStart() {
  const childId = await getChildId();
  if (!childId) redirect("/barn");

  const admin = createAdminClient();
  const { data: child } = await admin
    .from("child_profiles")
    .select("id, alias, icon, balance_minutes, family_id")
    .eq("id", childId)
    .single();
  if (!child) redirect("/barn");

  const [choresRes, ledgerRes, stravaRes, streakRes, catalogRes, earnedRes] = await Promise.all([
    admin
      .from("chores")
      .select("id, name, icon, reward_minutes, approval_mode, frequency")
      .eq("family_id", child.family_id)
      .eq("active", true)
      .order("category")
      .order("created_at")
      .order("id"),
    admin
      .from("ledger_entries")
      .select("id, delta_minutes, kind, note, created_at")
      .eq("child_id", childId)
      .order("created_at", { ascending: false })
      .limit(10),
    admin.from("strava_connections").select("id").eq("child_id", childId).maybeSingle(),
    admin.from("child_streaks").select("current_streak").eq("child_id", childId).maybeSingle(),
    admin.from("badges").select("id, name, icon, description, kind, threshold").order("threshold"),
    admin.from("child_badges").select("badge_id").eq("child_id", childId),
  ]);

  const chores = (choresRes.data ?? []) as ChoreOpt[];
  const tz = await familyTimezone(admin, child.family_id);
  const doneSet = await doneChoreIdsThisPeriod(admin, childId, chores, tz);

  const earnedIds = new Set((earnedRes.data ?? []).map((b) => b.badge_id as string));
  const badges: BadgeView[] = (catalogRes.data ?? []).map((b) => ({
    id: b.id as string,
    name: b.name as string,
    icon: b.icon as string,
    description: b.description as string,
    earned: earnedIds.has(b.id as string),
  }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <span className="text-lg font-semibold">
          {child.icon ? `${child.icon} ` : ""}
          {child.alias}
        </span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <form action={childLogout}>
            <button className="text-sm text-muted-foreground transition hover:text-foreground">
              Logga ut
            </button>
          </form>
        </div>
      </header>

      <ChildHome
        initialBalance={child.balance_minutes}
        chores={chores}
        ledger={(ledgerRes.data ?? []) as LedgerEntry[]}
        stravaConnected={Boolean(stravaRes.data)}
        streak={streakRes.data?.current_streak ?? 0}
        doneChoreIds={[...doneSet]}
        badges={badges}
      />
    </main>
  );
}
