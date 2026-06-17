import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope?: string;
  athlete?: { id: number };
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const childId = searchParams.get("state") ?? "";
  if (!code || !childId) return NextResponse.redirect(`${origin}/dashboard`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // RLS guarantees the child belongs to the signed-in user's family.
  const { data: child } = await supabase
    .from("child_profiles")
    .select("id, family_id")
    .eq("id", childId)
    .single();
  if (!child) return NextResponse.redirect(`${origin}/dashboard`);

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    return NextResponse.redirect(`${origin}/dashboard/child/${childId}?strava=error`);
  }
  const tok = (await res.json()) as TokenResponse;

  await supabase.from("strava_connections").upsert(
    {
      family_id: child.family_id,
      child_id: child.id,
      athlete_id: tok.athlete?.id ?? 0,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: new Date(tok.expires_at * 1000).toISOString(),
      scope: tok.scope ?? null,
    },
    { onConflict: "child_id" },
  );

  return NextResponse.redirect(`${origin}/dashboard/child/${childId}?strava=connected`);
}
