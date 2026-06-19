import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_TIMEZONE = "Europe/Stockholm";
const COUNTED_STATUSES = ["approved", "auto_approved", "ai_approved"];

/** Local calendar day "YYYY-MM-DD" for an instant in a timezone. */
export function localDay(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const ISO_DOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Local ISO weekday (1=Mon..7=Sun) and minutes-from-midnight for an instant in a timezone. */
export function localClock(date: Date, tz: string): { dow: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const min = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { dow: ISO_DOW[wd] ?? 1, minute: hour * 60 + min };
}

/** Monday (ISO week start) of the week containing `dayStr`, as "YYYY-MM-DD". Pure calendar math. */
export function weekStartDay(dayStr: string): string {
  const [y, m, d] = dayStr.split("-").map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = noon.getUTCDay(); // 0=Sun..6=Sat
  const isoDow = dow === 0 ? 7 : dow; // 1=Mon..7=Sun
  noon.setUTCDate(noon.getUTCDate() - (isoDow - 1));
  return noon.toISOString().slice(0, 10);
}

/** Pure: is a chore done in its current period given its counted-completion local days? */
export function isDoneThisPeriod(freq: string, completionDays: string[], today: string): boolean {
  if (freq === "daily") return completionDays.includes(today);
  if (freq === "weekly") {
    const monday = weekStartDay(today);
    return completionDays.some((d) => d >= monday && d <= today);
  }
  return false; // once / asneeded are not period-guarded here
}

/** The family's configured timezone (falls back to Europe/Stockholm). */
export async function familyTimezone(db: SupabaseClient, familyId: string): Promise<string> {
  const { data } = await db.from("families").select("timezone").eq("id", familyId).single();
  return data?.timezone ?? DEFAULT_TIMEZONE;
}

/**
 * Which of the given chores are already done in their current period (daily/weekly only).
 * Shared by the child checklist and the logging guard so they can never disagree.
 */
export async function doneChoreIdsThisPeriod(
  db: SupabaseClient,
  childId: string,
  chores: { id: string; frequency: string }[],
  tz: string,
  now: Date = new Date(),
): Promise<Set<string>> {
  const recurring = chores.filter((c) => c.frequency === "daily" || c.frequency === "weekly");
  if (recurring.length === 0) return new Set();

  const cutoff = new Date(now.getTime() - 8 * 86_400_000).toISOString();
  const { data } = await db
    .from("chore_completions")
    .select("chore_id, created_at")
    .eq("child_id", childId)
    .in("chore_id", recurring.map((c) => c.id))
    .in("status", COUNTED_STATUSES)
    .gte("created_at", cutoff);

  const byChore = new Map<string, string[]>();
  for (const row of data ?? []) {
    const day = localDay(new Date(row.created_at as string), tz);
    const arr = byChore.get(row.chore_id as string) ?? [];
    arr.push(day);
    byChore.set(row.chore_id as string, arr);
  }

  const today = localDay(now, tz);
  const done = new Set<string>();
  for (const c of recurring) {
    if (isDoneThisPeriod(c.frequency, byChore.get(c.id) ?? [], today)) done.add(c.id);
  }
  return done;
}
