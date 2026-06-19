import { describe, expect, it } from "vitest";
import { earnedBadgeIds } from "./badges";

describe("earnedBadgeIds", () => {
  it("awards the first-chore badge from a single completion", () => {
    expect(earnedBadgeIds({ longest: 0, metersTotal: 0, choresTotal: 1, hasAi: false })).toEqual([
      "first_chore",
    ]);
  });
  it("awards milestones once thresholds are crossed", () => {
    const ids = earnedBadgeIds({ longest: 30, metersTotal: 150_000, choresTotal: 50, hasAi: true });
    expect(ids).toEqual(
      expect.arrayContaining(["first_chore", "chores_50", "streak_7", "streak_30", "km_100", "first_ai"]),
    );
  });
  it("does not award km_100 below 100 km (meters)", () => {
    expect(earnedBadgeIds({ longest: 0, metersTotal: 99_999, choresTotal: 0, hasAi: false })).toEqual(
      [],
    );
  });
  it("awards nothing for an empty profile", () => {
    expect(earnedBadgeIds({ longest: 0, metersTotal: 0, choresTotal: 0, hasAi: false })).toEqual([]);
  });
});
