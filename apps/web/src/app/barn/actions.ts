"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { signChildToken, verifyPin } from "@/lib/child/session";
import { CHILD_COOKIE, getChildId } from "@/lib/child/server";

export async function childLogin(formData: FormData) {
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  const pin = String(formData.get("pin") ?? "").trim();
  if (!code || !pin) redirect("/barn?fel=1");

  const admin = createAdminClient();
  const { data: child } = await admin
    .from("child_profiles")
    .select("id, pin_hash")
    .eq("login_code", code)
    .maybeSingle();
  if (!child || !verifyPin(pin, child.pin_hash)) redirect("/barn?fel=1");

  const jar = await cookies();
  jar.set(CHILD_COOKIE, signChildToken(child.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/barn/start");
}

export async function childLogout() {
  const jar = await cookies();
  jar.delete(CHILD_COOKIE);
  redirect("/barn");
}

/** A child logs one of their family's chores as done. Child-scoped via cookie. */
export async function logChore(formData: FormData) {
  const childId = await getChildId();
  if (!childId) redirect("/barn");
  const choreId = String(formData.get("choreId") ?? "");
  if (!choreId) return;

  const admin = createAdminClient();
  const { data: child } = await admin
    .from("child_profiles")
    .select("family_id")
    .eq("id", childId)
    .single();
  if (!child) return;

  const { data: chore } = await admin
    .from("chores")
    .select("id, name, reward_minutes, approval_mode, family_id, active")
    .eq("id", choreId)
    .single();
  if (!chore || chore.family_id !== child.family_id || !chore.active) return;

  const { data: completion } = await admin
    .from("chore_completions")
    .insert({
      family_id: chore.family_id,
      chore_id: chore.id,
      child_id: childId,
      status: "pending",
    })
    .select("id")
    .single();
  if (!completion) return;

  // Auto-approved chores credit immediately; others wait for a parent in /dashboard/approvals.
  if (chore.approval_mode === "auto") {
    const { data: entry } = await admin
      .from("ledger_entries")
      .insert({
        family_id: chore.family_id,
        child_id: childId,
        delta_minutes: chore.reward_minutes,
        kind: "earn_chore",
        source_type: "chore_completion",
        source_id: completion.id,
        note: chore.name,
      })
      .select("id")
      .single();
    await admin
      .from("chore_completions")
      .update({
        status: "auto_approved",
        minutes_awarded: chore.reward_minutes,
        ledger_entry_id: entry?.id ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", completion.id);
  }

  revalidatePath("/barn/start");
}
