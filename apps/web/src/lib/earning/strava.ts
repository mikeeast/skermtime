import {
  computeRunMinutes,
  isEligibleRun,
  type StravaActivityInput,
} from "./rules";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API = "https://www.strava.com/api/v3";

export type StravaTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
};

export type StravaWebhookEvent = {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  updates?: Record<string, string>;
};

export type ProcessDecision =
  | { action: "credit"; minutes: number }
  | { action: "ignore"; reason: string };

/** Pure: what a webhook event means for our ledger. */
export function decideFromEvent(
  event: StravaWebhookEvent,
): "process_activity" | "clawback_activity" | "ignore" {
  if (event.object_type !== "activity") return "ignore";
  if (event.aspect_type === "delete") return "clawback_activity";
  return "process_activity";
}

/** Pure: reward for a fetched activity given the family's rule. */
export function rewardForActivity(
  activity: StravaActivityInput,
  opts: {
    minutesPerKm: number;
    dailyCapMinutes?: number | null;
    earnedTodayMinutes?: number;
  },
): ProcessDecision {
  if (!isEligibleRun(activity)) {
    return { action: "ignore", reason: "not an eligible run" };
  }
  const minutes = computeRunMinutes(activity.distance, opts);
  if (minutes <= 0) return { action: "ignore", reason: "cap reached or zero" };
  return { action: "credit", minutes };
}

/** Pure: should we refresh (60s early)? */
export function tokenExpired(expiresAt: number, nowSec: number): boolean {
  return expiresAt - 60 <= nowSec;
}

// ── I/O (gated on STRAVA_CLIENT_ID/SECRET being configured) ──

export function stravaConfigured(): boolean {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}

export async function refreshStravaToken(refreshToken: string): Promise<StravaTokens> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`);
  return (await res.json()) as StravaTokens;
}

export type StravaActivity = StravaActivityInput & {
  id: number;
  start_date: string;
};

export async function fetchStravaActivity(
  activityId: number,
  accessToken: string,
): Promise<StravaActivity> {
  const res = await fetch(`${STRAVA_API}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Strava activity fetch failed: ${res.status}`);
  return (await res.json()) as StravaActivity;
}
