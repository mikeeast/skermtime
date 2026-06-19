import { describe, expect, it } from "vitest";
import { approvalPendingEmail, lowBalanceEmail, weeklySummaryEmail } from "./templates";

const appUrl = "https://skermtime.vercel.app";

describe("email templates", () => {
  it("approval includes the child alias and chore name", () => {
    const e = approvalPendingEmail({ childAlias: "Felix", choreName: "Diska", appUrl });
    expect(e.subject).toContain("Felix");
    expect(e.html).toContain("Diska");
    expect(e.html).toContain(`${appUrl}/dashboard/approvals`);
  });
  it("escapes HTML in user content", () => {
    const e = approvalPendingEmail({ childAlias: "<b>x</b>", choreName: "a & b", appUrl });
    expect(e.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(e.html).toContain("a &amp; b");
  });
  it("low balance shows the remaining minutes", () => {
    expect(lowBalanceEmail({ childAlias: "Q", minutes: 10, appUrl }).html).toContain("10 min");
  });
  it("weekly summary lists each child", () => {
    const e = weeklySummaryEmail({ items: [{ alias: "Q", earned: 60, spent: 30 }], appUrl });
    expect(e.html).toContain("Q");
    expect(e.html).toContain("+60");
  });
});
