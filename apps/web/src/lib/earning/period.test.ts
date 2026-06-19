import { describe, expect, it } from "vitest";
import { isDoneThisPeriod, localDay, weekStartDay } from "./period";

describe("localDay", () => {
  it("resolves the local calendar day in a timezone (DST-aware)", () => {
    // 22:30 UTC in summer (UTC+2) is already the next day in Stockholm.
    expect(localDay(new Date("2026-06-19T22:30:00Z"), "Europe/Stockholm")).toBe("2026-06-20");
    expect(localDay(new Date("2026-06-19T09:00:00Z"), "Europe/Stockholm")).toBe("2026-06-19");
  });
});

describe("weekStartDay", () => {
  // 2024-01-01 is a known Monday.
  it("returns the Monday of the week", () => {
    expect(weekStartDay("2024-01-01")).toBe("2024-01-01"); // Mon
    expect(weekStartDay("2024-01-03")).toBe("2024-01-01"); // Wed
    expect(weekStartDay("2024-01-07")).toBe("2024-01-01"); // Sun
    expect(weekStartDay("2024-01-08")).toBe("2024-01-08"); // next Mon
  });
});

describe("isDoneThisPeriod", () => {
  it("daily: done only if today is among the completion days", () => {
    expect(isDoneThisPeriod("daily", ["2026-06-20"], "2026-06-20")).toBe(true);
    expect(isDoneThisPeriod("daily", ["2026-06-19"], "2026-06-20")).toBe(false);
  });
  it("weekly: done if any completion falls in the current Mon–today window", () => {
    // today Wed 2024-01-03; Monday is 2024-01-01
    expect(isDoneThisPeriod("weekly", ["2024-01-01"], "2024-01-03")).toBe(true);
    expect(isDoneThisPeriod("weekly", ["2023-12-31"], "2024-01-03")).toBe(false); // last week
  });
  it("once / asneeded are not period-guarded", () => {
    expect(isDoneThisPeriod("once", ["2026-06-20"], "2026-06-20")).toBe(false);
    expect(isDoneThisPeriod("asneeded", ["2026-06-20"], "2026-06-20")).toBe(false);
  });
});
