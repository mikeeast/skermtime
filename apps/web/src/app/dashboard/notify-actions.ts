"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseDailyCap } from "@/lib/earning/settings";

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("families").select("id").limit(1);
  const familyId = data?.[0]?.id as string | undefined;
  if (!familyId) redirect("/dashboard");
  return { supabase, familyId };
}

export async function updateNotifyPrefs(formData: FormData) {
  const { supabase, familyId } = await ctx();
  await supabase.from("notification_prefs").upsert(
    {
      family_id: familyId,
      email_approvals: formData.get("email_approvals") === "on",
      email_low_balance: formData.get("email_low_balance") === "on",
      email_weekly: formData.get("email_weekly") === "on",
      low_balance_threshold: parseDailyCap(String(formData.get("low_balance_threshold") ?? "")) ?? 15,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "family_id" },
  );
  revalidatePath(`/dashboard/child/${String(formData.get("childId") ?? "")}`);
}
