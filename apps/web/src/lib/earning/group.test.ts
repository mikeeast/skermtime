import { describe, expect, it } from "vitest";
import { computeGroupBonus, countCoRunners, overlaps, type RunWindow } from "./group";

const w = (startMin: number, durMin: number): RunWindow => ({
  start: startMin * 60_000,
  end: (startMin + durMin) * 60_000,
});

describe("overlaps", () => {
  it("true when overlap >= 5 min", () => {
    expect(overlaps(w(0, 30), w(10, 30))).toBe(true); // 20 min overlap
  });
  it("false when overlap < 5 min", () => {
    expect(overlaps(w(0, 30), w(27, 30))).toBe(false); // 3 min overlap
  });
  it("false when disjoint", () => {
    expect(overlaps(w(0, 30), w(60, 30))).toBe(false);
  });
  it("true when one contains the other", () => {
    expect(overlaps(w(0, 60), w(10, 10))).toBe(true);
  });
});

describe("countCoRunners", () => {
  it("counts only sufficiently overlapping peers", () => {
    expect(countCoRunners(w(0, 30), [w(5, 30), w(60, 30), w(28, 30)])).toBe(1);
  });
});

describe("computeGroupBonus", () => {
  it("adds perPeerPct per co-runner", () => {
    expect(computeGroupBonus(100, 2, { perPeerPct: 10, capPct: 50 })).toBe(20);
  });
  it("caps the bonus", () => {
    expect(computeGroupBonus(100, 9, { perPeerPct: 10, capPct: 50 })).toBe(50);
  });
  it("is zero without co-runners or base", () => {
    expect(computeGroupBonus(100, 0, { perPeerPct: 10, capPct: 50 })).toBe(0);
    expect(computeGroupBonus(0, 3, { perPeerPct: 10, capPct: 50 })).toBe(0);
  });
});
