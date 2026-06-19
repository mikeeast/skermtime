import { describe, expect, it } from "vitest";
import { shouldRunAi } from "./complete";

describe("shouldRunAi", () => {
  it("runs only for ai mode with an after photo and a configured key", () => {
    expect(shouldRunAi("ai", true, true)).toBe(true);
  });
  it("does not run without an after photo", () => {
    expect(shouldRunAi("ai", false, true)).toBe(false);
  });
  it("does not run when AI is not configured", () => {
    expect(shouldRunAi("ai", true, false)).toBe(false);
  });
  it("does not run for non-ai approval modes", () => {
    expect(shouldRunAi("auto", true, true)).toBe(false);
    expect(shouldRunAi("parent", true, true)).toBe(false);
  });
});
