import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decideFromEvent,
  fetchStravaActivity,
  refreshStravaToken,
  rewardForActivity,
  tokenExpired,
  type StravaWebhookEvent,
} from "@/lib/earning/strava";
import { DEFAULT_TIMEZONE } from "@/lib/earning/period";
import { awardStreaksAndBadges } from "@/lib/engagement/badges";
import { awardGroupRunBonuses, clawbackGroupBonus } from "@/lib/earning/group";

// Strava subscription validation handshake.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (
    searchParams.get("hub.mode") === "subscribe" &&
    searchParams.get("hub.verify_token") === process.env.STRAVA_VERIFY_TOKEN
  ) {
    return NextResponse.json({ "hub.challenge": searchParams.get("hub.challenge") });
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const event = (await request.json()) as StravaWebhookEvent;
  const action = decideFromEvent(event);
  if (action === "ignore") return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("strava_connections")
    .select("*")
    .eq("athlete_id", event.owner_id)
    .single();
  if (!conn) return NextResponse.json({ ok: true });

  // A deleted activity claws back any minutes we previously credited.
  if (action === "clawback_activity") {
    const { data: act } = await admin
      .from("strava_activities")
      .select("id, ledger_entry_id, minutes_awarded, child_id, family_id")
      .eq("strava_activity_id", event.object_id)
      .maybeSingle();
    if (act && act.minutes_awarded > 0) {
      await admin.from("ledger_entries").insert({
        family_id: act.family_id,
        child_id: act.child_id,
        delta_minutes: -act.minutes_awarded,
        kind: "clawback",
        source_type: "strava",
        source_id: String(event.object_id),
        note: "Strava-runda raderad",
      });
    }
    await clawbackGroupBonus(admin, event.object_id);
    if (act) await admin.from("strava_activities").delete().eq("id", act.id);
    return NextResponse.json({ ok: true });
  }

  // Dedupe: only process an activity once.
  const { data: existing } = await admin
    .from("strava_activities")
    .select("id")
    .eq("strava_activity_id", event.object_id)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true });

  // Refresh the access token if it is about to expire.
  let accessToken = conn.access_token as string;
  const expiresAtSec = Math.floor(new Date(conn.expires_at as string).getTime() / 1000);
  const nowSec = Math.floor(Date.now() / 1000);
  if (tokenExpired(expiresAtSec, nowSec)) {
    const refreshed = await refreshStravaToken(conn.refresh_token as string);
    accessToken = refreshed.access_token;
    await admin
      .from("strava_connections")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
      })
      .eq("id", conn.id);
  }

  const activity = await fetchStravaActivity(event.object_id, accessToken);

  const { data: fam } = await admin
    .from("families")
    .select(
      "strava_minutes_per_km, daily_cap_minutes, timezone, group_bonus_enabled, group_bonus_pct_per_peer, group_bonus_cap_pct",
    )
    .eq("id", conn.family_id)
    .single();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { data: todays } = await admin
    .from("ledger_entries")
    .select("delta_minutes")
    .eq("child_id", conn.child_id)
    .eq("kind", "earn_strava")
    .gte("created_at", startOfDay.toISOString());
  const earnedToday = (todays ?? []).reduce(
    (sum: number, r: { delta_minutes: number }) => sum + (r.delta_minutes ?? 0),
    0,
  );

  const decision = rewardForActivity(
    {
      type: activity.type,
      distance: activity.distance,
      moving_time: activity.moving_time,
      manual: activity.manual,
      flagged: activity.flagged,
    },
    {
      minutesPerKm: fam?.strava_minutes_per_km ?? 10,
      dailyCapMinutes: fam?.daily_cap_minutes ?? null,
      earnedTodayMinutes: earnedToday,
    },
  );

  let minutes = 0;
  let ledgerId: string | null = null;
  if (decision.action === "credit") {
    minutes = decision.minutes;
    const { data: entry } = await admin
      .from("ledger_entries")
      .insert({
        family_id: conn.family_id,
        child_id: conn.child_id,
        delta_minutes: minutes,
        kind: "earn_strava",
        source_type: "strava",
        source_id: String(event.object_id),
        note: `${(activity.distance / 1000).toFixed(1)} km`,
      })
      .select("id")
      .single();
    ledgerId = entry?.id ?? null;
  }

  await admin.from("strava_activities").insert({
    family_id: conn.family_id,
    child_id: conn.child_id,
    strava_activity_id: event.object_id,
    type: activity.type,
    distance_m: activity.distance,
    moving_time_s: activity.moving_time,
    started_at: activity.start_date,
    minutes_awarded: minutes,
    ledger_entry_id: ledgerId,
  });

  if (decision.action === "credit") {
    await awardStreaksAndBadges(admin, {
      childId: conn.child_id,
      familyId: conn.family_id,
      tz: fam?.timezone ?? DEFAULT_TIMEZONE,
    });
    await awardGroupRunBonuses(
      admin,
      {
        strava_activity_id: event.object_id,
        child_id: conn.child_id,
        family_id: conn.family_id,
        started_at: activity.start_date,
        moving_time_s: activity.moving_time,
        minutes_awarded: minutes,
      },
      {
        enabled: fam?.group_bonus_enabled ?? true,
        perPeerPct: fam?.group_bonus_pct_per_peer ?? 10,
        capPct: fam?.group_bonus_cap_pct ?? 50,
      },
    );
  }

  return NextResponse.json({ ok: true });
}
