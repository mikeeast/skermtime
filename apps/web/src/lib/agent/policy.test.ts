import { describe, expect, it } from "vitest";
import { evaluateSchedule, type LockWindow } from "./policy";

// 21:00–07:00 on Mon–Thu (school nights). 21:00 = 1260, 07:00 = 420.
const bedtime: LockWindow[] = [{ startMin: 1260, endMin: 420, days: [1, 2, 3, 4] }];

describe("evaluateSchedule", () => {
  it("locks late at night on a scheduled day", () => {
    // Monday 22:00 → 1320
    expect(evaluateSchedule(bedtime, 1, 1320).inWindow).toBe(true);
  });
  it("locks early morning as part of the previous day's window", () => {
    // Tuesday 06:00 → 360, belongs to Monday's 21:00–07:00
    expect(evaluateSchedule(bedtime, 2, 360).inWindow).toBe(true);
  });
  it("does not lock during the day", () => {
    // Monday 15:00 → 900
    const e = evaluateSchedule(bedtime, 1, 900);
    expect(e.inWindow).toBe(false);
    expect(e.minutesUntilWindow).toBe(360); // 1260 - 900
  });
  it("does not lock on a non-scheduled night", () => {
    // Friday 23:00 → 1380 (Fri = 5 not in days)
    expect(evaluateSchedule(bedtime, 5, 1380).inWindow).toBe(false);
  });
  it("Saturday early morning is not covered (Friday not scheduled)", () => {
    // Saturday 06:00 → prevDow Fri(5) not in days
    expect(evaluateSchedule(bedtime, 6, 360).inWindow).toBe(false);
  });
  it("handles an empty schedule", () => {
    expect(evaluateSchedule([], 1, 1320)).toEqual({ inWindow: false, minutesUntilWindow: null });
  });
});
