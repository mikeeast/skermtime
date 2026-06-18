// Pure bedtime / quiet-hours evaluation, mirrored by the .NET agent (Schedule.cs)
// for the offline fallback. Windows are minutes-from-local-midnight + ISO weekdays
// (1=Mon..7=Sun); a window wraps past midnight when endMin <= startMin.
export type LockWindow = { startMin: number; endMin: number; days: number[] };

export type ScheduleEval = { inWindow: boolean; minutesUntilWindow: number | null };

export function evaluateSchedule(windows: LockWindow[], dow: number, minute: number): ScheduleEval {
  let inWindow = false;
  let nextStart: number | null = null;

  for (const w of windows) {
    const wraps = w.endMin <= w.startMin;
    if (wraps) {
      // Late-night part belongs to the start day; early-morning part to the next day.
      const prevDow = dow === 1 ? 7 : dow - 1;
      if (
        (w.days.includes(dow) && minute >= w.startMin) ||
        (w.days.includes(prevDow) && minute < w.endMin)
      ) {
        inWindow = true;
      }
    } else if (w.days.includes(dow) && minute >= w.startMin && minute < w.endMin) {
      inWindow = true;
    }

    // Soonest upcoming start later today (for a pre-warning).
    if (w.days.includes(dow) && w.startMin > minute) {
      const delta = w.startMin - minute;
      nextStart = nextStart === null ? delta : Math.min(nextStart, delta);
    }
  }

  return { inWindow, minutesUntilWindow: inWindow ? null : nextStart };
}
