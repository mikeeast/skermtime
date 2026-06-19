import { describe, expect, it } from "vitest";
import { isExpired, metricLabel, progressPct } from "./challenges";

describe("progressPct", () => {
  it("scales to a clamped 0–100", () => {
    expect(progressPct(5, 10)).toBe(50);
    expect(progressPct(10, 10)).toBe(100);
    expect(progressPct(15, 10)).toBe(100); // clamped
    expect(progressPct(0, 10)).toBe(0);
  });
  it("is 0 for a non-positive goal", () => {
    expect(progressPct(5, 0)).toBe(0);
  });
});

describe("isExpired", () => {
  const now = new Date("2026-06-19T12:00:00Z");
  it("true once the window has ended", () => {
    expect(isExpired("2026-06-18T12:00:00Z", now)).toBe(true);
  });
  it("false while still active", () => {
    expect(isExpired("2026-06-20T12:00:00Z", now)).toBe(false);
  });
});

describe("metricLabel", () => {
  it("maps each metric", () => {
    expect(metricLabel("distance_m")).toContain("km");
    expect(metricLabel("runs")).toContain("löprundor");
    expect(metricLabel("earn_minutes")).toContain("minuter");
  });
});
