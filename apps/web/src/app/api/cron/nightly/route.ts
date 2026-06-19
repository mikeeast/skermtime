import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAuthorized } from "@/lib/cron/guard";
import { DEFAULT_TIMEZONE } from "@/lib/earning/period";
import { awardStreaksAndBadges } from "@/lib/engagement/badges";
import { completeChallengeIfDone } from "@/lib/social/challenges";

export const runtime = "nodejs";

// Nightly: recompute streaks + (re)evaluate badges for every child, so broken
// streaks and newly-crossed milestones are caught even on no-earn days.
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: children } = await admin.from("child_profiles").select("id, family_id");
  if (!children?.length) return NextResponse.json({ processed: 0 });

  const famIds = [...new Set(children.map((c) => c.family_id))];
  const { data: fams } = await admin.from("families").select("id, timezone").in("id", famIds);
  const tzByFam = new Map((fams ?? []).map((f) => [f.id, (f.timezone as string) ?? DEFAULT_TIMEZONE]));

  for (const c of children) {
    await awardStreaksAndBadges(admin, {
      childId: c.id,
      familyId: c.family_id,
      tz: tzByFam.get(c.family_id) ?? DEFAULT_TIMEZONE,
    });
  }

  // Finalize/expire active challenges (catches chore-based goals + lapsed windows).
  const { data: active } = await admin.from("challenges").select("id").eq("status", "active");
  for (const ch of active ?? []) {
    await completeChallengeIfDone(admin, ch.id as string);
  }

  return NextResponse.json({ processed: children.length, challenges: active?.length ?? 0 });
}
