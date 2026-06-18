"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FAMILY_COOKIE, getActiveFamilyId, listFamilies } from "@/lib/family/server";

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const familyId = await getActiveFamilyId(supabase);
  if (!familyId) redirect("/dashboard");
  return { supabase, user, familyId };
}

export async function createCoParentInvite() {
  const { supabase, user, familyId } = await ctx();
  await supabase.from("family_invites").insert({ family_id: familyId, invited_by: user.id });
  revalidatePath("/dashboard/family");
}

export async function revokeCoParentInvite(formData: FormData) {
  const id = String(formData.get("inviteId") ?? "");
  if (!id) return;
  const { supabase, familyId } = await ctx();
  await supabase.from("family_invites").delete().eq("id", id).eq("family_id", familyId);
  revalidatePath("/dashboard/family");
}

export async function acceptCoParentInvite(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/inbjudan/${code}`);
  const { data: familyId } = await supabase.rpc("accept_family_invite", { p_code: code });
  if (familyId) {
    const jar = await cookies();
    jar.set(FAMILY_COOKIE, familyId as string, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  redirect("/dashboard");
}

/** Ensure the family has a referral code (idempotent), used to render the invite link. */
export async function ensureReferralCode() {
  const { supabase, familyId } = await ctx();
  await supabase
    .from("referral_codes")
    .upsert({ family_id: familyId }, { onConflict: "family_id", ignoreDuplicates: true });
  revalidatePath("/dashboard/family");
}

/** Switch which family is active (when a co-parent belongs to more than one). */
export async function switchFamily(formData: FormData) {
  const id = String(formData.get("familyId") ?? "");
  const { supabase } = await ctx();
  const fams = await listFamilies(supabase);
  if (!fams.some((f) => f.id === id)) return;
  const jar = await cookies();
  jar.set(FAMILY_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}
