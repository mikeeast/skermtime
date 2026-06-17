// Pure, deterministic earning logic — the heart of Skermtime.
// No I/O here so it can be unit-tested in isolation.

export const STRAVA_RUN_TYPES = ["Run", "TrailRun", "VirtualRun"] as const;
export type StravaRunType = (typeof STRAVA_RUN_TYPES)[number];

export type StravaActivityInput = {
  type: string;
  distance: number; // meters
  moving_time: number; // seconds
  manual?: boolean;
  flagged?: boolean;
};

/** Guard against spoofed runs: ignore sustained speeds above ~25 km/h. */
export const MAX_PLAUSIBLE_SPEED_MPS = 7;

/** Whether a Strava activity should earn screen time. */
export function isEligibleRun(a: StravaActivityInput): boolean {
  if (!STRAVA_RUN_TYPES.includes(a.type as StravaRunType)) return false;
  if (a.manual) return false; // manually entered -> no GPS, not trusted
  if (a.flagged) return false;
  if (a.distance <= 0 || a.moving_time <= 0) return false;
  const speedMps = a.distance / a.moving_time;
  if (speedMps > MAX_PLAUSIBLE_SPEED_MPS) return false;
  return true;
}

export type RunRewardOptions = {
  minutesPerKm: number;
  dailyCapMinutes?: number | null;
  earnedTodayMinutes?: number;
};

/** Screen-time minutes earned from a run, after applying the daily cap. */
export function computeRunMinutes(
  distanceMeters: number,
  { minutesPerKm, dailyCapMinutes, earnedTodayMinutes = 0 }: RunRewardOptions,
): number {
  const km = distanceMeters / 1000;
  let minutes = Math.floor(km * minutesPerKm);
  if (minutes < 0) minutes = 0;
  if (dailyCapMinutes != null) {
    const remaining = Math.max(0, dailyCapMinutes - earnedTodayMinutes);
    minutes = Math.min(minutes, remaining);
  }
  return minutes;
}
