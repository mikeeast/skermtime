import { describe, it, expect } from "vitest";
import { decideFromVerdict } from "./verifyChore";

describe("decideFromVerdict", () => {
  it("auto-approves a confident 'done' verdict", () => {
    expect(decideFromVerdict({ done: true, confidence: 0.95, reason: "" })).toBe("ai_approved");
  });
  it("escalates a low-confidence verdict to the parent", () => {
    expect(decideFromVerdict({ done: true, confidence: 0.5, reason: "" })).toBe("parent");
  });
  it("escalates a 'not done' verdict to the parent regardless of confidence", () => {
    expect(decideFromVerdict({ done: false, confidence: 0.99, reason: "" })).toBe("parent");
  });
  it("respects a custom threshold", () => {
    expect(decideFromVerdict({ done: true, confidence: 0.7, reason: "" }, 0.6)).toBe("ai_approved");
  });
});
