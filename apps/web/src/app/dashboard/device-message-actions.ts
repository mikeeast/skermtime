"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveFamilyId } from "@/lib/family/server";

/** Send a short message to all of a child's paired computers (shown on the overlay). */
export async function sendDeviceMessage(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");
  const body = String(formData.get("body") ?? "")
    .trim()
    .slice(0, 300);
  if (!childId || !body) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const familyId = await getActiveFamilyId(supabase);
  if (!familyId) return;

  const { data: devices } = await supabase
    .from("devices")
    .select("id")
    .eq("child_id", childId)
    .eq("revoked", false)
    .eq("paired", true);

  const rows = (devices ?? []).map((d) => ({
    device_id: d.id,
    family_id: familyId,
    child_id: childId,
    body,
    created_by: user.id,
  }));
  if (rows.length > 0) await supabase.from("device_messages").insert(rows);
  revalidatePath(`/dashboard/child/${childId}`);
}
