import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAuthorized } from "@/lib/cron/guard";
import { notifyLowBalance } from "@/lib/notify/emit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const day = new Date().toISOString().slice(0, 10);

  const [childrenRes, prefsRes] = await Promise.all([
    admin.from("child_profiles").select("id, alias, family_id, balance_minutes"),
    admin.from("notification_prefs").select("family_id, low_balance_threshold, email_low_balance"),
  ]);
  const prefsByFamily = new Map((prefsRes.data ?? []).map((p) => [p.family_id, p]));

  let sent = 0;
  for (const c of childrenRes.data ?? []) {
    const p = prefsByFamily.get(c.family_id);
    const threshold = p?.low_balance_threshold ?? 15;
    if ((p?.email_low_balance ?? true) === false) continue;
    if ((c.balance_minutes ?? 0) > threshold) continue;
    const ok = await notifyLowBalance(admin, {
      familyId: c.family_id,
      childId: c.id,
      alias: c.alias,
      minutes: c.balance_minutes ?? 0,
      day,
    });
    if (ok) sent++;
  }
  return NextResponse.json({ checked: childrenRes.data?.length ?? 0, sent });
}
