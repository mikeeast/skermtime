import { describe, expect, it } from "vitest";
import { parseDailyCap, parseMinutesPerKm } from "./settings";

describe("parseDailyCap", () => {
  it("empty string means no cap", () => {
    expect(parseDailyCap("")).toBeNull();
    expect(parseDailyCap("   ")).toBeNull();
  });
  it("non-numeric means no cap", () => {
    expect(parseDailyCap("x")).toBeNull();
  });
  it("zero is a real cap", () => {
    expect(parseDailyCap("0")).toBe(0);
  });
  it("clamps negatives to zero", () => {
    expect(parseDailyCap("-5")).toBe(0);
  });
  it("truncates to an int", () => {
    expect(parseDailyCap("45")).toBe(45);
    expect(parseDailyCap("45.9")).toBe(45);
  });
});

describe("parseMinutesPerKm", () => {
  it("falls back on non-numeric", () => {
    expect(parseMinutesPerKm("x")).toBe(10);
    expect(parseMinutesPerKm("", 12)).toBe(12);
  });
  it("clamps to [0, 600]", () => {
    expect(parseMinutesPerKm("-3")).toBe(0);
    expect(parseMinutesPerKm("9999")).toBe(600);
  });
  it("truncates to an int", () => {
    expect(parseMinutesPerKm("10")).toBe(10);
    expect(parseMinutesPerKm("7.8")).toBe(7);
  });
});
