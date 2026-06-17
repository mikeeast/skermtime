import { NextResponse } from "next/server";
import { authDevice } from "@/lib/agent/auth";

// We REWARD tamper attempts (a bug bounty for your own kid) — but only the
// first discovery of each distinct technique pays out, to prevent farming.
const BOUNTY_MINUTES = 30;

export async function POST(request: Request) {
  const ctx = await authDevice(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { admin, device } = ctx;

  const body = (await request.json().catch(() => ({}))) as { type?: string; writeup?: string };
  const type = (body.type ?? "unknown").slice(0, 64);

  const { data: prior } = await admin
    .from("tamper_events")
    .select("id")
    .eq("device_id", device.id)
    .eq("type", type)
    .limit(1)
    .maybeSingle();
  const bonus = prior ? 0 : BOUNTY_MINUTES;

  await admin.from("tamper_events").insert({
    family_id: device.family_id,
    child_id: device.child_id,
    device_id: device.id,
    type,
    bonus_minutes: bonus,
    bonus_awarded: bonus > 0,
    writeup: body.writeup ?? null,
  });

  if (bonus > 0) {
    await admin.from("ledger_entries").insert({
      family_id: device.family_id,
      child_id: device.child_id,
      delta_minutes: bonus,
      kind: "bounty",
      source_type: "tamper",
      source_id: device.id,
      note: type,
    });
  }

  return NextResponse.json({
    bonusMinutes: bonus,
    message: bonus > 0 ? "Snyggt hack! Bonus utbetald." : "Den tekniken är redan upptäckt.",
  });
}
