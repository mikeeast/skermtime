"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  const { error } = await supabase
    .from("families")
    .insert({ name, owner_id: user.id });
  if (error) throw new Error(error.message);

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

  const { data: families } = await supabase
    .from("families")
    .select("id")
    .limit(1);
  const familyId = families?.[0]?.id;
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
