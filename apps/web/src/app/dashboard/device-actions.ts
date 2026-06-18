"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveFamilyId } from "@/lib/family/server";
import { newPairingCode } from "@/lib/agent/token";

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const familyId = await getActiveFamilyId(supabase);
  if (!familyId) redirect("/dashboard");
  return { supabase, familyId };
}

export async function createDevice(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");
  const name = String(formData.get("name") ?? "").trim() || "PC";
  if (!childId) return;
  const { supabase, familyId } = await ctx();
  await supabase.from("devices").insert({
    family_id: familyId,
    child_id: childId,
    name,
    pairing_code: newPairingCode(),
    code_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    paired: false,
  });
  revalidatePath(`/dashboard/child/${childId}`);
}

export async function revokeDevice(formData: FormData) {
  const id = String(formData.get("deviceId") ?? "");
  const childId = String(formData.get("childId") ?? "");
  if (!id) return;
  const { supabase, familyId } = await ctx();
  await supabase.from("devices").update({ revoked: true }).eq("id", id).eq("family_id", familyId);
  revalidatePath(`/dashboard/child/${childId}`);
}
