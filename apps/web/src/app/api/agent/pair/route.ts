import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, newDeviceToken } from "@/lib/agent/token";

// Agent exchanges a 6-digit pairing code for a long-lived device token.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    name?: string;
    os?: string;
    version?: string;
  };
  const code = (body.code ?? "").trim();
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  const admin = createAdminClient();
  const { data: device } = await admin
    .from("devices")
    .select("*")
    .eq("pairing_code", code)
    .eq("paired", false)
    .maybeSingle();
  if (!device) return NextResponse.json({ error: "invalid code" }, { status: 404 });
  if (device.code_expires_at && new Date(device.code_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "code expired" }, { status: 410 });
  }

  const token = newDeviceToken();
  await admin
    .from("devices")
    .update({
      token_hash: hashToken(token),
      paired: true,
      pairing_code: null,
      code_expires_at: null,
      name: body.name ?? device.name,
      os: body.os ?? null,
      agent_version: body.version ?? null,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", device.id);

  const { data: child } = await admin
    .from("child_profiles")
    .select("alias, balance_minutes")
    .eq("id", device.child_id)
    .single();

  return NextResponse.json({
    token,
    deviceId: device.id,
    childAlias: child?.alias ?? null,
    balanceMinutes: child?.balance_minutes ?? 0,
  });
}
