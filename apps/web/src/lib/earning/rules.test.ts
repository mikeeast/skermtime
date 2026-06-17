import { describe, it, expect } from "vitest";
import { computeRunMinutes, isEligibleRun } from "./rules";

describe("isEligibleRun", () => {
  it("accepts a normal GPS run", () => {
    expect(isEligibleRun({ type: "Run", distance: 5000, moving_time: 1800 })).toBe(true);
  });
  it("rejects manual entries", () => {
    expect(
      isEligibleRun({ type: "Run", distance: 5000, moving_time: 1800, manual: true }),
    ).toBe(false);
  });
  it("rejects flagged activities", () => {
    expect(
      isEligibleRun({ type: "Run", distance: 5000, moving_time: 1800, flagged: true }),
    ).toBe(false);
  });
  it("rejects non-run types", () => {
    expect(isEligibleRun({ type: "Ride", distance: 5000, moving_time: 600 })).toBe(false);
  });
  it("rejects implausible speed (car/bike spoof)", () => {
    // 20 km in 10 min = ~33 m/s
    expect(isEligibleRun({ type: "Run", distance: 20000, moving_time: 600 })).toBe(false);
  });
  it("rejects zero distance/time", () => {
    expect(isEligibleRun({ type: "Run", distance: 0, moving_time: 0 })).toBe(false);
  });
});

describe("computeRunMinutes", () => {
  it("awards minutesPerKm per km, floored", () => {
    expect(computeRunMinutes(5000, { minutesPerKm: 10 })).toBe(50);
    expect(computeRunMinutes(5500, { minutesPerKm: 10 })).toBe(55);
    expect(computeRunMinutes(5550, { minutesPerKm: 10 })).toBe(55);
  });
  it("applies the daily cap", () => {
    expect(computeRunMinutes(10000, { minutesPerKm: 10, dailyCapMinutes: 60 })).toBe(60);
  });
  it("accounts for minutes already earned today", () => {
    expect(
      computeRunMinutes(5000, {
        minutesPerKm: 10,
        dailyCapMinutes: 60,
        earnedTodayMinutes: 30,
      }),
    ).toBe(30);
  });
  it("returns 0 once the cap is already reached", () => {
    expect(
      computeRunMinutes(5000, {
        minutesPerKm: 10,
        dailyCapMinutes: 60,
        earnedTodayMinutes: 60,
      }),
    ).toBe(0);
  });
  it("never returns negative", () => {
    expect(computeRunMinutes(0, { minutesPerKm: 10 })).toBe(0);
  });
});
