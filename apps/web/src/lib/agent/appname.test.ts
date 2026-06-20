import { describe, expect, it } from "vitest";
import { normalizeAppName } from "./appname";

describe("normalizeAppName", () => {
  it("strips .exe and capitalizes", () => {
    expect(normalizeAppName("chrome.exe")).toBe("Chrome");
    expect(normalizeAppName("Minecraft")).toBe("Minecraft");
    expect(normalizeAppName("roblox.EXE")).toBe("Roblox");
  });
  it("falls back for empty input", () => {
    expect(normalizeAppName("")).toBe("Okänt");
    expect(normalizeAppName("   ")).toBe("Okänt");
  });
});
