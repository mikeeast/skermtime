import { NextResponse } from "next/server";
import { stravaConfigured } from "@/lib/earning/strava";

// Kicks off Strava OAuth for a given child (?child=<id>). The child id is
// round-tripped through the `state` parameter back to the callback.
export async function GET(request: Request) {
  if (!stravaConfigured()) {
    return NextResponse.json({ error: "Strava is not configured" }, { status: 503 });
  }
  const { searchParams, origin } = new URL(request.url);
  const childId = searchParams.get("child") ?? "";

  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", process.env.STRAVA_CLIENT_ID!);
  url.searchParams.set("redirect_uri", `${origin}/api/strava/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "activity:read");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("state", childId);
  return NextResponse.redirect(url.toString());
}
