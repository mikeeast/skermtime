import { NextResponse } from "next/server";
import { getChildId } from "@/lib/child/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHORE_PHOTO_BUCKET } from "@/lib/chore/complete";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB after client-side compression
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Receives a child's chore photo and stores it in the private bucket. The child
// has no JWT — authz comes entirely from the signed `skermtime_child` cookie, so
// family/child are derived server-side and never trusted from the request body.
export async function POST(request: Request) {
  const childId = await getChildId();
  if (!childId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const slot = String(form.get("slot") ?? "");
  const completionId = String(form.get("completionId") ?? "");

  if (!(file instanceof File) || (slot !== "before" && slot !== "after") || !UUID_RE.test(completionId)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (file.type !== "image/jpeg") {
    return NextResponse.json({ error: "jpeg only" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too large" }, { status: 413 });
  }

  const admin = createAdminClient();
  const { data: child } = await admin
    .from("child_profiles")
    .select("family_id")
    .eq("id", childId)
    .single();
  if (!child) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Prefix is server-derived; `completionId` is a validated path segment, not an authz boundary.
  const path = `${child.family_id}/${childId}/${completionId}/${slot}.jpg`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(CHORE_PHOTO_BUCKET).upload(path, buf, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) return NextResponse.json({ error: "upload failed" }, { status: 500 });

  return NextResponse.json({ path });
}
