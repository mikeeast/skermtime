import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHORE_PHOTO_BUCKET } from "@/lib/chore/complete";
import { cronAuthorized } from "@/lib/cron/guard";

export const runtime = "nodejs";

const RETENTION_DAYS = 14;

// GDPR: chore photos may show the home/children. Keep them only long enough for the
// audit trail, then purge. Gated on CRON_SECRET; wired to Vercel Cron (daily).
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  const { data: rows } = await admin
    .from("chore_completions")
    .select("id, photo_before, photo_after")
    .lt("created_at", cutoff)
    .or("photo_before.not.is.null,photo_after.not.is.null")
    .limit(500);

  const paths = (rows ?? []).flatMap((r) =>
    [r.photo_before, r.photo_after].filter((p): p is string => Boolean(p)),
  );
  if (paths.length > 0) {
    await admin.storage.from(CHORE_PHOTO_BUCKET).remove(paths);
    for (const r of rows ?? []) {
      await admin
        .from("chore_completions")
        .update({ photo_before: null, photo_after: null })
        .eq("id", r.id);
    }
  }

  return NextResponse.json({ purged: paths.length });
}
