import type { SupabaseClient } from "@supabase/supabase-js";

export type RunWindow = { start: number; end: number }; // epoch ms

const DEFAULT_MIN_OVERLAP_MS = 300_000; // 5 minutes

/** Pure: do two run windows overlap by at least `minOverlapMs`? */
export function overlaps(a: RunWindow, b: RunWindow, minOverlapMs = DEFAULT_MIN_OVERLAP_MS): boolean {
  const lo = Math.max(a.start, b.start);
  const hi = Math.min(a.end, b.end);
  return hi - lo >= minOverlapMs;
}

/** Pure: how many peer runs overlap `self`. */
export function countCoRunners(
  self: RunWindow,
  peers: RunWindow[],
  minOverlapMs = DEFAULT_MIN_OVERLAP_MS,
): number {
  return peers.filter((p) => overlaps(self, p, minOverlapMs)).length;
}

/** Pure: bonus minutes for running with `coRunners` friends — "more runners, more points". */
export function computeGroupBonus(
  baseMinutes: number,
  coRunners: number,
  opts: { perPeerPct: number; capPct: number },
): number {
  if (coRunners <= 0 || baseMinutes <= 0) return 0;
  const pct = Math.min(opts.capPct, opts.perPeerPct * coRunners);
  return Math.floor((baseMinutes * pct) / 100);
}

// ── I/O helpers (admin client) ──

type ActivityRow = {
  strava_activity_id: number;
  child_id: string;
  family_id: string;
  started_at: string | null;
  moving_time_s: number | null;
  minutes_awarded: number;
};

export type GroupBonusSettings = { enabled: boolean; perPeerPct: number; capPct: number };

function windowOf(a: { started_at: string | null; moving_time_s: number | null }): RunWindow | null {
  if (!a.started_at) return null;
  const start = new Date(a.started_at).getTime();
  return { start, end: start + (a.moving_time_s ?? 0) * 1000 };
}

async function friendIdsOf(admin: SupabaseClient, childId: string): Promise<string[]> {
  const { data } = await admin
    .from("child_friendships")
    .select("child_a, child_b")
    .or(`child_a.eq.${childId},child_b.eq.${childId}`);
  return (data ?? []).map((r) => (r.child_a === childId ? r.child_b : r.child_a) as string);
}

/**
 * Ensure a single (idempotent) group-run bonus exists for one activity, based on the
 * runner's friends' overlapping eligible runs currently in the DB. Append-only safe:
 * inserts at most once per activity (keyed by source_id), never mutates the ledger.
 */
async function ensureBonusForActivity(
  admin: SupabaseClient,
  act: ActivityRow,
  settings: GroupBonusSettings,
): Promise<void> {
  if (!settings.enabled || (act.minutes_awarded ?? 0) <= 0) return;
  const self = windowOf(act);
  if (!self) return;

  const { data: existing } = await admin
    .from("ledger_entries")
    .select("id")
    .eq("source_type", "group_run")
    .eq("source_id", String(act.strava_activity_id))
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const friendIds = await friendIdsOf(admin, act.child_id);
  if (friendIds.length === 0) return;

  const lo = new Date(self.start - 3 * 3_600_000).toISOString();
  const hi = new Date(self.end + 3 * 3_600_000).toISOString();
  const { data: peerActs } = await admin
    .from("strava_activities")
    .select("started_at, moving_time_s, minutes_awarded")
    .in("child_id", friendIds)
    .gte("started_at", lo)
    .lte("started_at", hi);

  const peerWindows = (peerActs ?? [])
    .filter((p) => (p.minutes_awarded ?? 0) > 0)
    .map((p) => windowOf(p))
    .filter((w): w is RunWindow => w !== null);

  const co = countCoRunners(self, peerWindows);
  const bonus = computeGroupBonus(act.minutes_awarded, co, {
    perPeerPct: settings.perPeerPct,
    capPct: settings.capPct,
  });
  if (bonus <= 0) return;

  await admin.from("ledger_entries").insert({
    family_id: act.family_id,
    child_id: act.child_id,
    delta_minutes: bonus,
    kind: "earn_group_bonus",
    source_type: "group_run",
    source_id: String(act.strava_activity_id),
    note: `Sprang med ${co} kompis${co === 1 ? "" : "ar"} 🏃`,
  });
}

/**
 * Award group-run bonuses after a run is credited: the runner, plus any overlapping
 * friend whose own run hadn't been bonus-credited yet (it ran before this one).
 */
export async function awardGroupRunBonuses(
  admin: SupabaseClient,
  self: ActivityRow,
  settings: GroupBonusSettings,
): Promise<void> {
  if (!settings.enabled) return;
  await ensureBonusForActivity(admin, self, settings);

  const selfWin = windowOf(self);
  if (!selfWin) return;
  const friendIds = await friendIdsOf(admin, self.child_id);
  if (friendIds.length === 0) return;

  const lo = new Date(selfWin.start - 3 * 3_600_000).toISOString();
  const hi = new Date(selfWin.end + 3 * 3_600_000).toISOString();
  const { data: peerActs } = await admin
    .from("strava_activities")
    .select("strava_activity_id, child_id, family_id, started_at, moving_time_s, minutes_awarded")
    .in("child_id", friendIds)
    .gte("started_at", lo)
    .lte("started_at", hi);

  for (const p of peerActs ?? []) {
    const pWin = windowOf(p);
    if (!pWin || !overlaps(selfWin, pWin)) continue;
    await ensureBonusForActivity(admin, p as ActivityRow, settings);
  }
}

/** Reverse a group-run bonus when its activity is deleted at Strava. */
export async function clawbackGroupBonus(
  admin: SupabaseClient,
  stravaActivityId: number,
): Promise<void> {
  const { data: bonus } = await admin
    .from("ledger_entries")
    .select("family_id, child_id, delta_minutes")
    .eq("source_type", "group_run")
    .eq("source_id", String(stravaActivityId))
    .maybeSingle();
  if (bonus && (bonus.delta_minutes ?? 0) > 0) {
    await admin.from("ledger_entries").insert({
      family_id: bonus.family_id,
      child_id: bonus.child_id,
      delta_minutes: -bonus.delta_minutes,
      kind: "clawback",
      source_type: "group_run",
      source_id: String(stravaActivityId),
      note: "Grupp-bonus återtagen",
    });
  }
}
