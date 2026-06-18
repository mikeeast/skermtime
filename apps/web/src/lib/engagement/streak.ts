import type { SupabaseClient } from "@supabase/supabase-js";
import { localDay } from "@/lib/earning/period";

/** Shift a "YYYY-MM-DD" day by n days (pure calendar math). */
export function addDays(dayStr: string, n: number): string {
  const [y, m, d] = dayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/**
 * Pure: current + longest streak from a set of active local days.
 * "current" is only alive if today or yesterday is active.
 */
export function computeStreak(
  activeDays: string[],
  today: string,
): { current: number; longest: number } {
  const set = new Set(activeDays);
  if (set.size === 0) return { current: 0, longest: 0 };

  const sorted = [...set].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === addDays(sorted[i - 1], 1) ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  let anchor: string | null = set.has(today)
    ? today
    : set.has(addDays(today, -1))
      ? addDays(today, -1)
      : null;
  let current = 0;
  while (anchor && set.has(anchor)) {
    current++;
    anchor = addDays(anchor, -1);
  }

  return { current, longest };
}

/** Recompute and cache a child's streak from the ledger (idempotent). Returns the all-time longest. */
export async function recomputeStreak(
  client: SupabaseClient,
  childId: string,
  familyId: string,
  tz: string,
  now: Date = new Date(),
): Promise<{ current: number; longest: number }> {
  const cutoff = new Date(now.getTime() - 60 * 86_400_000).toISOString();
  const { data } = await client
    .from("ledger_entries")
    .select("created_at, kind")
    .eq("child_id", childId)
    .in("kind", ["earn_chore", "earn_strava"])
    .gte("created_at", cutoff);

  const days = [...new Set((data ?? []).map((r) => localDay(new Date(r.created_at as string), tz)))];
  const today = localDay(now, tz);
  const { current, longest } = computeStreak(days, today);

  const { data: existing } = await client
    .from("child_streaks")
    .select("longest_streak")
    .eq("child_id", childId)
    .maybeSingle();
  const longestAll = Math.max(longest, existing?.longest_streak ?? 0);
  const lastActive = days.length ? [...days].sort().at(-1) ?? null : null;

  await client.from("child_streaks").upsert(
    {
      child_id: childId,
      family_id: familyId,
      current_streak: current,
      longest_streak: longestAll,
      last_active_day: lastActive,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "child_id" },
  );

  return { current, longest: longestAll };
}
