import { test, expect } from "@playwright/test";

const MAILPIT = "http://127.0.0.1:54424";

type MailpitMsg = { ID: string; To?: Array<{ Address?: string }> };
type MailpitList = { messages?: MailpitMsg[] };
type MailpitFull = { Text?: string; HTML?: string };

/** Poll Mailpit for the magic-link email sent to `email` and return the link. */
async function getMagicLink(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const list = (await fetch(`${MAILPIT}/api/v1/messages?limit=20`).then((r) =>
      r.json(),
    )) as MailpitList;
    const msg = (list.messages ?? []).find((m) =>
      (m.To ?? []).some((t) => t.Address?.toLowerCase() === email.toLowerCase()),
    );
    if (msg) {
      const full = (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`).then((r) =>
        r.json(),
      )) as MailpitFull;
      const body = full.Text || full.HTML || "";
      const urls = body.match(/https?:\/\/[^\s"'<>\\]+/g) ?? [];
      const link = urls.find((u) => u.includes("/auth/")) ?? urls[0];
      if (link) return link.replace(/&amp;/g, "&");
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error("magic-link email not found in Mailpit");
}

test("parent logs in via magic link and manages a family", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/login");
  await page.getByPlaceholder("din@epost.se").fill(email);
  await page.getByRole("button", { name: /Skicka inloggningslänk/i }).click();
  await expect(page.getByText(/Mailpit/i)).toBeVisible();

  const link = await getMagicLink(email);
  await page.goto(link);

  // Landed in the app — create a family.
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByPlaceholder("Familjenamn").fill("E2E Familj");
  await page.getByRole("button", { name: "Skapa" }).click();
  await expect(page.getByText("E2E Familj")).toBeVisible();

  // Add a child and see it appear.
  await page.getByPlaceholder("Barnets alias").fill("E2E-barn");
  await page.getByRole("button", { name: /^Lägg till$/ }).click();
  await expect(page.getByText("E2E-barn")).toBeVisible();
});
