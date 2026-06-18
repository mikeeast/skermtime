"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveFamilyId, REFERRAL_COOKIE } from "@/lib/family/server";

export async function createFamily(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: families_insert_self_owned requires owner_id = auth.uid().
  // A trigger then enrolls the owner into family_members.
  const { data: created, error } = await supabase
    .from("families")
    .insert({ name, owner_id: user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Redeem a referral code captured before sign-up (best-effort).
  const jar = await cookies();
  const refCode = jar.get(REFERRAL_COOKIE)?.value;
  if (refCode && created?.id) {
    await supabase.rpc("redeem_referral", { p_code: refCode, p_referred_family: created.id });
    jar.delete(REFERRAL_COOKIE);
  }

  revalidatePath("/dashboard");
}

export async function addChild(formData: FormData) {
  const alias = String(formData.get("alias") ?? "").trim();
  const icon = String(formData.get("icon") ?? "").trim() || null;
  if (!alias) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const familyId = await getActiveFamilyId(supabase);
  if (!familyId) return;

  const { error } = await supabase
    .from("child_profiles")
    .insert({ family_id: familyId, alias, icon });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
