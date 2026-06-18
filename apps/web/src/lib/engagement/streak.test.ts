import { describe, expect, it } from "vitest";
import { addDays, computeStreak } from "./streak";

describe("addDays", () => {
  it("crosses month boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("computeStreak", () => {
  it("counts a current streak ending today", () => {
    expect(computeStreak(["2026-06-18", "2026-06-19", "2026-06-20"], "2026-06-20")).toEqual({
      current: 3,
      longest: 3,
    });
  });
  it("keeps the streak alive if yesterday (not today) was active", () => {
    expect(computeStreak(["2026-06-18", "2026-06-19"], "2026-06-20")).toEqual({
      current: 2,
      longest: 2,
    });
  });
  it("resets current to 0 after a gap, but remembers the longest", () => {
    expect(computeStreak(["2026-06-10", "2026-06-11", "2026-06-12"], "2026-06-20")).toEqual({
      current: 0,
      longest: 3,
    });
  });
  it("handles an empty history", () => {
    expect(computeStreak([], "2026-06-20")).toEqual({ current: 0, longest: 0 });
  });
});
