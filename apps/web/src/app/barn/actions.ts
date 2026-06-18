"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { signChildToken, verifyPin } from "@/lib/child/session";
import { CHILD_COOKIE, getChildId } from "@/lib/child/server";
import { aiConfigured } from "@/lib/ai/verifyChore";
import { creditCompletion, runAiDecision, shouldRunAi } from "@/lib/chore/complete";

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
  const completionId = String(formData.get("completionId") ?? "") || undefined;
  const beforePath = String(formData.get("beforeUrl") ?? "") || null;
  const afterPath = String(formData.get("afterUrl") ?? "") || null;

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
      ...(completionId ? { id: completionId } : {}),
      family_id: chore.family_id,
      chore_id: chore.id,
      child_id: childId,
      status: "pending",
      photo_before: beforePath,
      photo_after: afterPath,
    })
    .select("id")
    .single();
  if (!completion) return;

  let decision: "auto_approved" | "ai_approved" | "parent" = "parent";
  let verdict: unknown = null;

  if (chore.approval_mode === "auto") {
    decision = "auto_approved";
  } else if (afterPath && shouldRunAi(chore.approval_mode, true, aiConfigured())) {
    const res = await runAiDecision(admin, {
      choreName: chore.name,
      beforePath,
      afterPath,
    });
    decision = res.decision;
    verdict = res.verdict;
  }

  // Auto/AI-approved chores credit immediately; others wait for a parent in /dashboard/approvals.
  if (decision === "auto_approved" || decision === "ai_approved") {
    await creditCompletion(admin, {
      familyId: chore.family_id,
      childId,
      completionId: completion.id,
      minutes: chore.reward_minutes,
      status: decision,
      note: chore.name,
      verdict,
    });
  } else if (verdict) {
    await admin.from("chore_completions").update({ ai_verdict: verdict }).eq("id", completion.id);
  }

  revalidatePath("/barn/start");
}
