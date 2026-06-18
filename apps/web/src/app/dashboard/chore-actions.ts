"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { aiConfigured, decideFromVerdict, verifyChorePhotos } from "@/lib/ai/verifyChore";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("families").select("id").limit(1);
  const familyId = data?.[0]?.id as string | undefined;
  if (!familyId) redirect("/dashboard");
  return { supabase, user, familyId };
}

/** Insert an earn ledger entry and finalize the completion. Balance updates via DB trigger. */
async function creditCompletion(
  supabase: ServerClient,
  familyId: string,
  childId: string,
  completionId: string,
  minutes: number,
  status: "approved" | "auto_approved" | "ai_approved",
  decidedBy: string,
  verdict: unknown,
) {
  const { data: entry } = await supabase
    .from("ledger_entries")
    .insert({
      family_id: familyId,
      child_id: childId,
      delta_minutes: minutes,
      kind: "earn_chore",
      source_type: "chore_completion",
      source_id: completionId,
      created_by: decidedBy,
    })
    .select("id")
    .single();

  await supabase
    .from("chore_completions")
    .update({
      status,
      minutes_awarded: minutes,
      ledger_entry_id: entry?.id ?? null,
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
      ai_verdict: verdict ?? null,
    })
    .eq("id", completionId);
}

export async function activateLibraryChore(formData: FormData) {
  const libId = String(formData.get("choreId") ?? "");
  if (!libId) return;
  const { supabase, familyId } = await ctx();
  const { data: lib } = await supabase
    .from("chores")
    .select("category, name, icon, reward_minutes, duration_minutes, frequency, approval_mode")
    .eq("id", libId)
    .is("family_id", null)
    .single();
  if (!lib) return;
  await supabase.from("chores").insert({
    family_id: familyId,
    category: lib.category,
    name: lib.name,
    icon: lib.icon,
    reward_minutes: lib.reward_minutes,
    duration_minutes: lib.duration_minutes,
    frequency: lib.frequency,
    approval_mode: lib.approval_mode,
    created_by_role: "parent",
    is_approved: true,
  });
  revalidatePath("/dashboard/chores");
}

export async function createChore(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || "Eget";
  const rewardRaw = Number(formData.get("reward"));
  const durationRaw = Number(formData.get("duration"));
  const approval = String(formData.get("approval") ?? "parent");
  if (!name) return;
  const { supabase, familyId } = await ctx();
  await supabase.from("chores").insert({
    family_id: familyId,
    category,
    name,
    reward_minutes: Number.isFinite(rewardRaw) ? Math.max(0, Math.trunc(rewardRaw)) : 30,
    duration_minutes: Number.isFinite(durationRaw) ? Math.max(0, Math.trunc(durationRaw)) : 10,
    approval_mode: ["auto", "parent", "ai"].includes(approval) ? approval : "parent",
    created_by_role: "parent",
    is_approved: true,
  });
  revalidatePath("/dashboard/chores");
}

export async function setChoreReward(formData: FormData) {
  const id = String(formData.get("choreId") ?? "");
  if (!id) return;
  const rewardRaw = Number(formData.get("reward"));
  const durationRaw = Number(formData.get("duration"));
  const patch: { reward_minutes?: number; duration_minutes?: number } = {};
  if (Number.isFinite(rewardRaw)) patch.reward_minutes = Math.max(0, Math.trunc(rewardRaw));
  if (Number.isFinite(durationRaw)) patch.duration_minutes = Math.max(0, Math.trunc(durationRaw));
  if (Object.keys(patch).length === 0) return;
  const { supabase, familyId } = await ctx();
  await supabase.from("chores").update(patch).eq("id", id).eq("family_id", familyId);
  revalidatePath("/dashboard/chores");
}

export async function deleteChore(formData: FormData) {
  const id = String(formData.get("choreId") ?? "");
  if (!id) return;
  const { supabase, familyId } = await ctx();
  await supabase.from("chores").delete().eq("id", id).eq("family_id", familyId);
  revalidatePath("/dashboard/chores");
}

export async function markChoreDone(formData: FormData) {
  const choreId = String(formData.get("choreId") ?? "");
  const childId = String(formData.get("childId") ?? "");
  const beforeUrl = String(formData.get("beforeUrl") ?? "") || null;
  const afterUrl = String(formData.get("afterUrl") ?? "") || null;
  if (!choreId || !childId) return;

  const { supabase, user, familyId } = await ctx();
  const { data: chore } = await supabase
    .from("chores")
    .select("id, name, reward_minutes, approval_mode")
    .eq("id", choreId)
    .single();
  if (!chore) return;

  const { data: completion } = await supabase
    .from("chore_completions")
    .insert({
      family_id: familyId,
      chore_id: chore.id,
      child_id: childId,
      status: "pending",
      photo_before: beforeUrl,
      photo_after: afterUrl,
    })
    .select("id")
    .single();
  if (!completion) return;

  let decision: "auto_approved" | "ai_approved" | "parent" = "parent";
  let verdict: unknown = null;

  if (chore.approval_mode === "auto") {
    decision = "auto_approved";
  } else if (chore.approval_mode === "ai" && afterUrl && aiConfigured()) {
    try {
      const v = await verifyChorePhotos({ choreName: chore.name, beforeUrl, afterUrl });
      verdict = v;
      decision = decideFromVerdict(v);
    } catch {
      decision = "parent"; // fall back to manual approval on any AI error
    }
  }

  if (decision === "auto_approved" || decision === "ai_approved") {
    await creditCompletion(
      supabase,
      familyId,
      childId,
      completion.id,
      chore.reward_minutes,
      decision,
      user.id,
      verdict,
    );
  } else if (verdict) {
    await supabase.from("chore_completions").update({ ai_verdict: verdict }).eq("id", completion.id);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/chores");
  revalidatePath("/dashboard/approvals");
}

export async function approveCompletion(formData: FormData) {
  const id = String(formData.get("completionId") ?? "");
  if (!id) return;
  const { supabase, user, familyId } = await ctx();
  const { data: c } = await supabase
    .from("chore_completions")
    .select("id, child_id, chore_id, status")
    .eq("id", id)
    .single();
  if (!c || c.status !== "pending") return;
  const { data: chore } = await supabase
    .from("chores")
    .select("reward_minutes")
    .eq("id", c.chore_id)
    .single();
  await creditCompletion(
    supabase,
    familyId,
    c.child_id,
    c.id,
    chore?.reward_minutes ?? 0,
    "approved",
    user.id,
    null,
  );
  revalidatePath("/dashboard/approvals");
  revalidatePath("/dashboard");
}

export async function rejectCompletion(formData: FormData) {
  const id = String(formData.get("completionId") ?? "");
  if (!id) return;
  const { supabase, user } = await ctx();
  await supabase
    .from("chore_completions")
    .update({ status: "rejected", decided_by: user.id, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  revalidatePath("/dashboard/approvals");
}

export async function adjustBalance(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");
  const minutes = Number(formData.get("minutes"));
  const note = String(formData.get("note") ?? "") || null;
  if (!childId || !Number.isFinite(minutes) || minutes === 0) return;
  const { supabase, user, familyId } = await ctx();
  await supabase.from("ledger_entries").insert({
    family_id: familyId,
    child_id: childId,
    delta_minutes: Math.trunc(minutes),
    kind: "adjust",
    source_type: "parent",
    note,
    created_by: user.id,
  });
  revalidatePath(`/dashboard/child/${childId}`);
  revalidatePath("/dashboard");
}

export async function awardBounty(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");
  const minutes = Number(formData.get("minutes"));
  const type = String(formData.get("type") ?? "manual").trim() || "manual";
  const writeup = String(formData.get("writeup") ?? "") || null;
  if (!childId || !Number.isFinite(minutes) || minutes <= 0) return;
  const { supabase, user, familyId } = await ctx();
  const bonus = Math.max(0, Math.trunc(minutes));
  await supabase.from("ledger_entries").insert({
    family_id: familyId,
    child_id: childId,
    delta_minutes: bonus,
    kind: "bounty",
    source_type: "tamper",
    note: writeup,
    created_by: user.id,
  });
  await supabase.from("tamper_events").insert({
    family_id: familyId,
    child_id: childId,
    type,
    bonus_minutes: bonus,
    bonus_awarded: true,
    writeup,
  });
  revalidatePath(`/dashboard/child/${childId}`);
}
