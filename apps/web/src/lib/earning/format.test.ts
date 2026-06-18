import { describe, it, expect } from "vitest";
import { formatMinutes } from "./format";

describe("formatMinutes", () => {
  it("formats whole hours", () => {
    expect(formatMinutes(240)).toBe("4 h");
    expect(formatMinutes(60)).toBe("1 h");
  });
  it("formats hours + minutes", () => {
    expect(formatMinutes(90)).toBe("1 h 30 min");
  });
  it("formats sub-hour as minutes", () => {
    expect(formatMinutes(45)).toBe("45 min");
  });
  it("handles zero/negative", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(-5)).toBe("0 min");
  });
});
