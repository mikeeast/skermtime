import type { SupabaseClient } from "@supabase/supabase-js";

export type FriendCard = {
  childId: string;
  alias: string;
  icon: string | null;
  streak: number;
  bucket: "hög" | "mellan" | "låg";
};
export type LeaderRow = {
  childId: string;
  alias: string;
  icon: string | null;
  earned: number;
  isSelf: boolean;
};

function bucketOf(min: number): "hög" | "mellan" | "låg" {
  if (min >= 180) return "hög";
  if (min >= 60) return "mellan";
  return "låg";
}

/** The child ids a child is friends with. */
export async function friendIdsOf(admin: SupabaseClient, childId: string): Promise<string[]> {
  const { data } = await admin
    .from("child_friendships")
    .select("child_a, child_b")
    .or(`child_a.eq.${childId},child_b.eq.${childId}`);
  return (data ?? []).map((r) => (r.child_a === childId ? r.child_b : r.child_a) as string);
}

/** Friend cards with a coarse activity bucket — never exact balance, never PII. */
export async function listFriendCards(admin: SupabaseClient, childId: string): Promise<FriendCard[]> {
  const ids = await friendIdsOf(admin, childId);
  if (ids.length === 0) return [];
  const [kidsRes, streaksRes] = await Promise.all([
    admin.from("child_profiles").select("id, alias, icon, balance_minutes").in("id", ids),
    admin.from("child_streaks").select("child_id, current_streak").in("child_id", ids),
  ]);
  const streakBy = new Map((streaksRes.data ?? []).map((s) => [s.child_id, s.current_streak]));
  return (kidsRes.data ?? []).map((k) => ({
    childId: k.id as string,
    alias: k.alias as string,
    icon: (k.icon as string | null) ?? null,
    streak: (streakBy.get(k.id) as number | undefined) ?? 0,
    bucket: bucketOf(k.balance_minutes ?? 0),
  }));
}

/** Weekly earned-minutes leaderboard among the child + friends (self always included). */
export async function getFriendLeaderboard(
  admin: SupabaseClient,
  childId: string,
): Promise<LeaderRow[]> {
  const ids = [childId, ...(await friendIdsOf(admin, childId))];
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [kidsRes, ledgerRes] = await Promise.all([
    admin.from("child_profiles").select("id, alias, icon").in("id", ids),
    admin
      .from("ledger_entries")
      .select("child_id, delta_minutes")
      .in("child_id", ids)
      .gt("delta_minutes", 0)
      .gte("created_at", since),
  ]);
  const earnedBy = new Map<string, number>();
  for (const e of ledgerRes.data ?? []) {
    earnedBy.set(e.child_id as string, (earnedBy.get(e.child_id as string) ?? 0) + (e.delta_minutes ?? 0));
  }
  return (kidsRes.data ?? [])
    .map((k) => ({
      childId: k.id as string,
      alias: k.alias as string,
      icon: (k.icon as string | null) ?? null,
      earned: earnedBy.get(k.id as string) ?? 0,
      isSelf: k.id === childId,
    }))
    .sort((a, b) => b.earned - a.earned);
}
