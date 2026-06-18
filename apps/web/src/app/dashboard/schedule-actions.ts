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

function hhmmToMin(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export async function createLockSchedule(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");
  const label = String(formData.get("label") ?? "").trim() || "Läggdags";
  const startMin = hhmmToMin(String(formData.get("start") ?? ""));
  const endMin = hhmmToMin(String(formData.get("end") ?? ""));
  const days = (formData.getAll("days") as string[]).map(Number).filter((d) => d >= 1 && d <= 7);
  if (!childId || startMin === null || endMin === null || days.length === 0) return;

  const { supabase, familyId } = await ctx();
  await supabase.from("lock_schedules").insert({
    family_id: familyId,
    child_id: childId,
    label,
    days,
    start_min: startMin,
    end_min: endMin,
    enabled: true,
  });
  revalidatePath(`/dashboard/child/${childId}`);
}

export async function deleteLockSchedule(formData: FormData) {
  const id = String(formData.get("scheduleId") ?? "");
  const childId = String(formData.get("childId") ?? "");
  if (!id) return;
  const { supabase, familyId } = await ctx();
  await supabase.from("lock_schedules").delete().eq("id", id).eq("family_id", familyId);
  revalidatePath(`/dashboard/child/${childId}`);
}

export async function setDailyScreenCap(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");
  if (!childId) return;
  const cap = parseDailyCap(String(formData.get("cap") ?? ""));
  const { supabase, familyId } = await ctx();
  await supabase
    .from("child_profiles")
    .update({ daily_screen_cap_minutes: cap })
    .eq("id", childId)
    .eq("family_id", familyId);
  revalidatePath(`/dashboard/child/${childId}`);
}
