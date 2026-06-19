import type { SupabaseClient } from "@supabase/supabase-js";
import { recomputeStreak } from "./streak";

export type BadgeStats = {
  longest: number;
  metersTotal: number;
  choresTotal: number;
  hasAi: boolean;
};

const COUNTED_STATUSES = ["approved", "auto_approved", "ai_approved"];
const STREAK_BONUS_MINUTES = 15;

/** Pure: which badge ids are earned for these stats. */
export function earnedBadgeIds(s: BadgeStats): string[] {
  const ids: string[] = [];
  if (s.choresTotal >= 1) ids.push("first_chore");
  if (s.choresTotal >= 50) ids.push("chores_50");
  if (s.longest >= 7) ids.push("streak_7");
  if (s.longest >= 30) ids.push("streak_30");
  if (s.metersTotal >= 100_000) ids.push("km_100");
  if (s.hasAi) ids.push("first_ai");
  return ids;
}

/** Award any newly-earned badges (idempotent) and a one-time streak bonus per streak badge. */
export async function evaluateBadges(
  client: SupabaseClient,
  childId: string,
  familyId: string,
  longest: number,
): Promise<string[]> {
  const [choresRes, kmRes, aiRes] = await Promise.all([
    client
      .from("chore_completions")
      .select("id", { count: "exact", head: true })
      .eq("child_id", childId)
      .in("status", COUNTED_STATUSES),
    client.from("strava_activities").select("distance_m").eq("child_id", childId),
    client
      .from("chore_completions")
      .select("id")
      .eq("child_id", childId)
      .eq("status", "ai_approved")
      .limit(1),
  ]);

  const metersTotal = (kmRes.data ?? []).reduce((sum, r) => sum + Number(r.distance_m ?? 0), 0);
  const earned = earnedBadgeIds({
    longest,
    metersTotal,
    choresTotal: choresRes.count ?? 0,
    hasAi: (aiRes.data ?? []).length > 0,
  });
  if (earned.length === 0) return [];

  // ON CONFLICT DO NOTHING — `.select()` returns only the newly-inserted rows.
  const { data: inserted } = await client
    .from("child_badges")
    .upsert(
      earned.map((badge_id) => ({ family_id: familyId, child_id: childId, badge_id })),
      { onConflict: "child_id,badge_id", ignoreDuplicates: true },
    )
    .select("badge_id");

  const newIds = (inserted ?? []).map((r) => r.badge_id as string);
  for (const id of newIds) {
    if (id.startsWith("streak_")) {
      await client.from("ledger_entries").insert({
        family_id: familyId,
        child_id: childId,
        delta_minutes: STREAK_BONUS_MINUTES,
        kind: "streak_bonus",
        source_type: "badge",
        source_id: id,
        note: "Svitbonus 🔥",
      });
    }
  }
  return newIds;
}

/**
 * Recompute the streak then evaluate badges. Best-effort: never throws into the
 * caller, so it can be appended to any credit path without risking the main flow.
 */
export async function awardStreaksAndBadges(
  client: SupabaseClient,
  opts: { childId: string; familyId: string; tz: string },
): Promise<void> {
  try {
    const { longest } = await recomputeStreak(client, opts.childId, opts.familyId, opts.tz);
    await evaluateBadges(client, opts.childId, opts.familyId, longest);
  } catch {
    /* engagement is non-critical — never block earning */
  }
}
