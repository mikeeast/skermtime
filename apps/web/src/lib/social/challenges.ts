import type { SupabaseClient } from "@supabase/supabase-js";
import { friendIdsOf } from "./friends";

export type Metric = "distance_m" | "runs" | "earn_minutes";

// Goal/progress units per metric: distance = km, runs = count, earn = minutes.
export function metricLabel(metric: string): string {
  if (metric === "distance_m") return "km tillsammans";
  if (metric === "runs") return "löprundor";
  return "minuter";
}

/** Pure: clamped 0–100 completion percentage. */
export function progressPct(progress: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((progress / goal) * 100));
}

export function isExpired(endsAt: string, now: Date = new Date()): boolean {
  return new Date(endsAt).getTime() < now.getTime();
}

type Challenge = {
  id: string;
  metric: string;
  goal: number;
  reward_minutes: number;
  starts_at: string;
  ends_at: string;
  status: string;
  title?: string;
  family_id?: string;
};

async function memberChildIds(admin: SupabaseClient, challengeId: string): Promise<string[]> {
  const { data } = await admin
    .from("challenge_members")
    .select("child_id")
    .eq("challenge_id", challengeId);
  return (data ?? []).map((r) => r.child_id as string);
}

/** Group progress in the metric's unit over all members within the active window. */
export async function challengeProgress(
  admin: SupabaseClient,
  challenge: Challenge,
  childIds: string[],
  now: Date = new Date(),
): Promise<number> {
  if (childIds.length === 0) return 0;
  const windowEnd = new Date(
    Math.min(now.getTime(), new Date(challenge.ends_at).getTime()),
  ).toISOString();

  if (challenge.metric === "earn_minutes") {
    const { data } = await admin
      .from("ledger_entries")
      .select("delta_minutes")
      .in("child_id", childIds)
      .gt("delta_minutes", 0)
      .gte("created_at", challenge.starts_at)
      .lte("created_at", windowEnd);
    return (data ?? []).reduce((s, r) => s + (r.delta_minutes ?? 0), 0);
  }

  const { data } = await admin
    .from("strava_activities")
    .select("distance_m")
    .in("child_id", childIds)
    .gte("started_at", challenge.starts_at)
    .lte("started_at", windowEnd);
  if (challenge.metric === "runs") return (data ?? []).length;
  // distance_m → km
  return Math.round(((data ?? []).reduce((s, r) => s + Number(r.distance_m ?? 0), 0) / 1000) * 10) / 10;
}

/**
 * If a challenge's group goal is reached, reward every member once (idempotent) and
 * mark it completed. If the window has ended without reaching the goal, mark it expired.
 */
export async function completeChallengeIfDone(
  admin: SupabaseClient,
  challengeId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const { data: ch } = await admin
    .from("challenges")
    .select("id, metric, goal, reward_minutes, starts_at, ends_at, status, title")
    .eq("id", challengeId)
    .maybeSingle();
  if (!ch || ch.status !== "active") return false;

  const childIds = await memberChildIds(admin, challengeId);
  const progress = await challengeProgress(admin, ch as Challenge, childIds, now);

  if (progress >= ch.goal) {
    const { data: members } = await admin
      .from("challenge_members")
      .select("child_id, family_id, rewarded")
      .eq("challenge_id", challengeId);
    for (const m of members ?? []) {
      if (m.rewarded) continue;
      await admin.from("ledger_entries").insert({
        family_id: m.family_id,
        child_id: m.child_id,
        delta_minutes: ch.reward_minutes,
        kind: "earn_challenge",
        source_type: "challenge",
        source_id: challengeId,
        note: `Utmaning klar: ${ch.title ?? ""}`.trim(),
      });
      await admin
        .from("challenge_members")
        .update({ rewarded: true })
        .eq("challenge_id", challengeId)
        .eq("child_id", m.child_id);
    }
    await admin
      .from("challenges")
      .update({ status: "completed", completed_at: now.toISOString() })
      .eq("id", challengeId)
      .eq("status", "active");
    return true;
  }

  if (isExpired(ch.ends_at, now)) {
    await admin
      .from("challenges")
      .update({ status: "expired" })
      .eq("id", challengeId)
      .eq("status", "active");
  }
  return false;
}

export type ChallengeView = {
  id: string;
  title: string;
  metric: string;
  goal: number;
  reward_minutes: number;
  ends_at: string;
  progress: number;
  members: number;
  creatorAlias?: string;
};

/** A child's active challenges (with progress) + joinable ones created by friends. */
export async function listChallengesForChild(
  admin: SupabaseClient,
  childId: string,
): Promise<{ mine: ChallengeView[]; joinable: ChallengeView[] }> {
  const { data: myMemberships } = await admin
    .from("challenge_members")
    .select("challenge_id")
    .eq("child_id", childId);
  const myIds = new Set((myMemberships ?? []).map((m) => m.challenge_id as string));

  const friendIds = await friendIdsOf(admin, childId);

  const { data: active } = await admin
    .from("challenges")
    .select("id, title, metric, goal, reward_minutes, ends_at, starts_at, status, created_by_child")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const mine: ChallengeView[] = [];
  const joinable: ChallengeView[] = [];
  for (const c of active ?? []) {
    const isMine = myIds.has(c.id as string);
    const byFriend = friendIds.includes(c.created_by_child as string);
    if (!isMine && !byFriend) continue;

    const childIds = await memberChildIds(admin, c.id as string);
    const progress = await challengeProgress(admin, c as Challenge, childIds);
    const view: ChallengeView = {
      id: c.id as string,
      title: c.title as string,
      metric: c.metric as string,
      goal: c.goal as number,
      reward_minutes: c.reward_minutes as number,
      ends_at: c.ends_at as string,
      progress,
      members: childIds.length,
    };
    if (isMine) mine.push(view);
    else joinable.push(view);
  }
  return { mine, joinable };
}
