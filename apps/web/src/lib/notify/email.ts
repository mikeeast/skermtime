// Email delivery via Resend (plain fetch, no SDK). In dev / when unconfigured it
// logs to the console so flows never break and CI stays green.
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const from = process.env.NOTIFY_FROM_EMAIL ?? "Skermtime <onboarding@resend.dev>";
  if (!emailConfigured()) {
    console.log(`[email:dev] → ${to} :: ${subject}`);
    return true;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
