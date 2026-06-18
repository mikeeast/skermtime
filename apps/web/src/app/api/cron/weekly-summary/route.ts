import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAuthorized } from "@/lib/cron/guard";
import { weekStartDay } from "@/lib/earning/period";
import { notifyWeeklySummary } from "@/lib/notify/emit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const weekKey = weekStartDay(new Date().toISOString().slice(0, 10));
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data: families } = await admin.from("families").select("id");
  let sent = 0;
  for (const f of families ?? []) {
    const [childrenRes, ledgerRes] = await Promise.all([
      admin.from("child_profiles").select("id, alias").eq("family_id", f.id),
      admin
        .from("ledger_entries")
        .select("child_id, delta_minutes")
        .eq("family_id", f.id)
        .gte("created_at", since),
    ]);
    if (!childrenRes.data?.length) continue;

    const agg = new Map<string, { earned: number; spent: number }>();
    for (const e of ledgerRes.data ?? []) {
      const a = agg.get(e.child_id as string) ?? { earned: 0, spent: 0 };
      if ((e.delta_minutes ?? 0) >= 0) a.earned += e.delta_minutes ?? 0;
      else a.spent += Math.abs(e.delta_minutes ?? 0);
      agg.set(e.child_id as string, a);
    }
    const items = childrenRes.data.map((c) => ({
      alias: c.alias as string,
      earned: agg.get(c.id as string)?.earned ?? 0,
      spent: agg.get(c.id as string)?.spent ?? 0,
    }));
    const ok = await notifyWeeklySummary(admin, { familyId: f.id, weekKey, items });
    if (ok) sent++;
  }
  return NextResponse.json({ families: families?.length ?? 0, sent });
}
