import { describe, it, expect } from "vitest";
import { decideFromEvent, rewardForActivity, tokenExpired } from "./strava";

describe("decideFromEvent", () => {
  it("processes activity create", () => {
    expect(
      decideFromEvent({
        object_type: "activity",
        object_id: 1,
        aspect_type: "create",
        owner_id: 9,
      }),
    ).toBe("process_activity");
  });
  it("claws back on delete", () => {
    expect(
      decideFromEvent({
        object_type: "activity",
        object_id: 1,
        aspect_type: "delete",
        owner_id: 9,
      }),
    ).toBe("clawback_activity");
  });
  it("ignores athlete events", () => {
    expect(
      decideFromEvent({
        object_type: "athlete",
        object_id: 1,
        aspect_type: "update",
        owner_id: 9,
      }),
    ).toBe("ignore");
  });
});

describe("rewardForActivity", () => {
  it("credits minutes for an eligible run", () => {
    const d = rewardForActivity(
      { type: "Run", distance: 5000, moving_time: 1800 },
      { minutesPerKm: 10 },
    );
    expect(d).toEqual({ action: "credit", minutes: 50 });
  });
  it("ignores a manual entry", () => {
    const d = rewardForActivity(
      { type: "Run", distance: 5000, moving_time: 1800, manual: true },
      { minutesPerKm: 10 },
    );
    expect(d.action).toBe("ignore");
  });
  it("ignores when the daily cap is already used up", () => {
    const d = rewardForActivity(
      { type: "Run", distance: 5000, moving_time: 1800 },
      { minutesPerKm: 10, dailyCapMinutes: 30, earnedTodayMinutes: 30 },
    );
    expect(d.action).toBe("ignore");
  });
});

describe("tokenExpired", () => {
  it("is true within the 60s refresh window", () => {
    expect(tokenExpired(1000, 950)).toBe(true);
  });
  it("is false when comfortably valid", () => {
    expect(tokenExpired(1000, 800)).toBe(false);
  });
});
