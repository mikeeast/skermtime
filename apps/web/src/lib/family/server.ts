import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const FAMILY_COOKIE = "skermtime_family";
export const REFERRAL_COOKIE = "skermtime_ref";

/** Families the signed-in user belongs to (RLS-scoped), oldest first. */
export async function listFamilies(
  supabase: SupabaseClient,
): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase.from("families").select("id, name").order("created_at");
  return (data ?? []) as { id: string; name: string }[];
}

/**
 * The active family id — a valid `skermtime_family` cookie if set, otherwise the
 * oldest family. Deterministic (replaces the old `.limit(1)` without ordering,
 * which picked an arbitrary row once a user belonged to more than one family).
 */
export async function getActiveFamilyId(supabase: SupabaseClient): Promise<string | null> {
  const fams = await listFamilies(supabase);
  if (fams.length === 0) return null;
  const jar = await cookies();
  const pref = jar.get(FAMILY_COOKIE)?.value;
  if (pref && fams.some((f) => f.id === pref)) return pref;
  return fams[0].id;
}
