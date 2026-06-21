import { NextResponse } from "next/server";
import { authDevice } from "@/lib/agent/auth";
import { DEFAULT_TIMEZONE, localClock, localDay } from "@/lib/earning/period";
import { evaluateSchedule, type LockWindow } from "@/lib/agent/policy";
import { normalizeAppName } from "@/lib/agent/appname";

// Agent reports consumed minutes and gets the current balance + lock policy back.
export async function POST(request: Request) {
  const ctx = await authDevice(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { admin, device } = ctx;

  const body = (await request.json().catch(() => ({}))) as {
    consumedMinutes?: number;
    version?: string;
    currentApp?: string;
    currentAppSeconds?: number;
  };
  const consumed = Math.max(0, Math.trunc(body.consumedMinutes ?? 0));
  const currentApp =
    typeof body.currentApp === "string" && body.currentApp.trim()
      ? normalizeAppName(body.currentApp)
      : null;
  const currentAppSeconds = Math.max(0, Math.trunc(body.currentAppSeconds ?? 0));

  if (consumed > 0) {
    await admin.from("ledger_entries").insert({
      family_id: device.family_id,
      child_id: device.child_id,
      delta_minutes: -consumed,
      kind: "spend",
      source_type: "agent",
      source_id: device.id,
      note: device.name,
    });
  }
  await admin
    .from("devices")
    .update({
      last_seen_at: new Date().toISOString(),
      ...(body.version ? { agent_version: body.version } : {}),
      ...(currentApp ? { current_app: currentApp, current_app_at: new Date().toISOString() } : {}),
    })
    .eq("id", device.id);

  const [childRes, famRes, scheduleRes] = await Promise.all([
    admin
      .from("child_profiles")
      .select("balance_minutes, daily_screen_cap_minutes")
      .eq("id", device.child_id)
      .single(),
    admin.from("families").select("timezone").eq("id", device.family_id).single(),
    admin
      .from("lock_schedules")
      .select("days, start_min, end_min")
      .eq("child_id", device.child_id)
      .eq("enabled", true),
  ]);

  const tz = famRes.data?.timezone ?? DEFAULT_TIMEZONE;
  const now = new Date();
  const { dow, minute } = localClock(now, tz);
  const windows: LockWindow[] = (scheduleRes.data ?? []).map((s) => ({
    startMin: s.start_min as number,
    endMin: s.end_min as number,
    days: (s.days as number[]) ?? [],
  }));
  const sched = evaluateSchedule(windows, dow, minute);

  // Daily screen-time cap: sum today's spend since local midnight.
  let dailyCapReached = false;
  const cap = childRes.data?.daily_screen_cap_minutes as number | null | undefined;
  if (cap != null) {
    const midnight = new Date(now.getTime() - minute * 60_000).toISOString();
    const { data: spent } = await admin
      .from("ledger_entries")
      .select("delta_minutes")
      .eq("child_id", device.child_id)
      .eq("kind", "spend")
      .gte("created_at", midnight);
    const usedToday = (spent ?? []).reduce((s, r) => s + Math.abs(r.delta_minutes ?? 0), 0);
    if (usedToday >= cap) dailyCapReached = true;
  }

  const lockNow = sched.inWindow || dailyCapReached;
  const reason = sched.inWindow ? "bedtime" : dailyCapReached ? "daily_cap" : null;

  // Accumulate per-app usage for today (family-local day).
  if (currentApp && currentAppSeconds > 0) {
    await admin.rpc("increment_app_usage", {
      p_device: device.id,
      p_child: device.child_id,
      p_family: device.family_id,
      p_app: currentApp,
      p_day: localDay(now, tz),
      p_seconds: currentAppSeconds,
    });
  }

  // Undelivered parent messages for this device — delivered exactly once.
  const { data: msgs } = await admin
    .from("device_messages")
    .select("id, body")
    .eq("device_id", device.id)
    .is("delivered_at", null)
    .order("created_at")
    .limit(10);
  if (msgs && msgs.length > 0) {
    await admin
      .from("device_messages")
      .update({ delivered_at: new Date().toISOString() })
      .in(
        "id",
        msgs.map((m) => m.id),
      );
  }

  return NextResponse.json({
    messages: (msgs ?? []).map((m) => ({ id: m.id, body: m.body })),
    balanceMinutes: childRes.data?.balance_minutes ?? 0,
    warnAtMinutes: [10, 5, 1],
    lockAtMinutes: 0,
    lockNow,
    reason,
    minutesUntilWindow: sched.minutesUntilWindow,
    scheduleWindows: windows.map((w) => ({ startMin: w.startMin, endMin: w.endMin, days: w.days })),
    serverLocalDow: dow,
    serverLocalMinute: minute,
  });
}
