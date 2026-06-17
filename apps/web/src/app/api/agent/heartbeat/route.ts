import { NextResponse } from "next/server";
import { authDevice } from "@/lib/agent/auth";

// Agent reports consumed minutes and gets the current balance + lock policy back.
export async function POST(request: Request) {
  const ctx = await authDevice(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { admin, device } = ctx;

  const body = (await request.json().catch(() => ({}))) as { consumedMinutes?: number };
  const consumed = Math.max(0, Math.trunc(body.consumedMinutes ?? 0));

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
  await admin.from("devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);

  const { data: child } = await admin
    .from("child_profiles")
    .select("balance_minutes")
    .eq("id", device.child_id)
    .single();

  return NextResponse.json({
    balanceMinutes: child?.balance_minutes ?? 0,
    warnAtMinutes: [10, 5, 1],
    lockAtMinutes: 0,
  });
}
