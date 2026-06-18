"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseDailyCap, parseMinutesPerKm } from "@/lib/earning/settings";

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

/** Disconnect a child's Strava: best-effort revoke at Strava, then delete locally. */
export async function disconnectStrava(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");
  if (!childId) return;
  const { supabase, familyId } = await ctx();

  const { data: conn } = await supabase
    .from("strava_connections")
    .select("access_token")
    .eq("child_id", childId)
    .eq("family_id", familyId)
    .maybeSingle();

  if (conn?.access_token) {
    try {
      await fetch("https://www.strava.com/oauth/deauthorize", {
        method: "POST",
        headers: { Authorization: `Bearer ${conn.access_token}` },
      });
    } catch {
      /* best-effort — we delete locally regardless */
    }
  }

  await supabase
    .from("strava_connections")
    .delete()
    .eq("child_id", childId)
    .eq("family_id", familyId);
  revalidatePath(`/dashboard/child/${childId}`);
}

/** Update family-wide earning settings (minutes/km + optional daily cap). Owner-only via RLS. */
export async function updateFamilyEarning(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");
  const minutesPerKm = parseMinutesPerKm(String(formData.get("minutesPerKm") ?? ""));
  const dailyCap = parseDailyCap(String(formData.get("dailyCap") ?? ""));
  const { supabase, familyId } = await ctx();

  await supabase
    .from("families")
    .update({ strava_minutes_per_km: minutesPerKm, daily_cap_minutes: dailyCap })
    .eq("id", familyId);

  if (childId) revalidatePath(`/dashboard/child/${childId}`);
}
