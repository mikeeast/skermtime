import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Local dev defaults (overridable via env). These are the shared local-only keys.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54421";
const SECRET =
  process.env.SUPABASE_SECRET_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const BASE = process.env.AGENT_TEST_BASE_URL || "http://localhost:3000";

const admin = createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false } });

let userId = "";
let familyId = "";
let childId = "";
const code = "424242";

async function post(path: string, body: unknown, token?: string) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const { data: u, error } = await admin.auth.admin.createUser({
    email: `agent-test-${Date.now()}@example.com`,
    password: "test-pass-123456",
    email_confirm: true,
  });
  if (error || !u.user) throw error ?? new Error("could not create test user");
  userId = u.user.id;

  const { data: fam, error: famErr } = await admin
    .from("families")
    .insert({ name: "Test Family", owner_id: userId })
    .select("id")
    .single();
  if (famErr || !fam) throw new Error("family insert failed: " + JSON.stringify(famErr));
  familyId = fam.id;

  const { data: child } = await admin
    .from("child_profiles")
    .insert({ family_id: familyId, alias: "Testbarn" })
    .select("id")
    .single();
  childId = child!.id;

  // Seed a starting balance of 60 minutes.
  await admin.from("ledger_entries").insert({
    family_id: familyId,
    child_id: childId,
    delta_minutes: 60,
    kind: "adjust",
    source_type: "test",
  });

  // Unpaired device with a known pairing code.
  await admin.from("devices").insert({
    family_id: familyId,
    child_id: childId,
    name: "Test-PC",
    pairing_code: code,
    code_expires_at: new Date(Date.now() + 900_000).toISOString(),
    paired: false,
  });
});

afterAll(async () => {
  if (familyId) await admin.from("families").delete().eq("id", familyId);
  if (userId) await admin.auth.admin.deleteUser(userId);
});

describe("agent API end-to-end", () => {
  let token = "";

  it("pairs with a valid code", async () => {
    const res = await post("/api/agent/pair", { code });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.childAlias).toBe("Testbarn");
    token = body.token;
  });

  it("rejects heartbeats without a token", async () => {
    const res = await post("/api/agent/heartbeat", { consumedMinutes: 5 });
    expect(res.status).toBe(401);
  });

  it("spends minutes on heartbeat (60 - 5 = 55)", async () => {
    const res = await post("/api/agent/heartbeat", { consumedMinutes: 5 }, token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balanceMinutes).toBe(55);
  });

  it("pays a bounty for a first-time tamper technique, not repeats", async () => {
    const first = await (await post("/api/agent/tamper", { type: "clock-change" }, token)).json();
    expect(first.bonusMinutes).toBe(30);
    const second = await (await post("/api/agent/tamper", { type: "clock-change" }, token)).json();
    expect(second.bonusMinutes).toBe(0);
  });

  it("reflects every movement in the cached balance (60 - 5 + 30 = 85)", async () => {
    const { data: child } = await admin
      .from("child_profiles")
      .select("balance_minutes")
      .eq("id", childId)
      .single();
    expect(child!.balance_minutes).toBe(85);
  });
});
