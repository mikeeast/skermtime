// Pure Swedish email templates. No I/O so they are unit-testable.
export type EmailContent = { subject: string; html: string };

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(body: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px">${body}<p style="color:#888;font-size:12px;margin-top:24px">Skermtime</p></div>`;
}

export function approvalPendingEmail(o: {
  childAlias: string;
  choreName: string;
  appUrl: string;
}): EmailContent {
  return {
    subject: `${o.childAlias} väntar på godkännande`,
    html: shell(
      `<p>${esc(o.childAlias)} har loggat sysslan <strong>${esc(o.choreName)}</strong> och väntar på ditt godkännande.</p>` +
        `<p><a href="${o.appUrl}/dashboard/approvals">Granska i Skermtime →</a></p>`,
    ),
  };
}

export function lowBalanceEmail(o: {
  childAlias: string;
  minutes: number;
  appUrl: string;
}): EmailContent {
  return {
    subject: `${o.childAlias} har snart slut på skärmtid`,
    html: shell(
      `<p>${esc(o.childAlias)} har bara <strong>${o.minutes} min</strong> skärmtid kvar.</p>` +
        `<p><a href="${o.appUrl}/dashboard">Öppna Skermtime →</a></p>`,
    ),
  };
}

export function weeklySummaryEmail(o: {
  items: { alias: string; earned: number; spent: number }[];
  appUrl: string;
}): EmailContent {
  const rows = o.items
    .map(
      (i) =>
        `<li>${esc(i.alias)}: <strong>+${i.earned}</strong> intjänat, <strong>${i.spent}</strong> förbrukat (min)</li>`,
    )
    .join("");
  return {
    subject: "Veckans skärmtid i Skermtime",
    html: shell(
      `<p>Så här gick veckan:</p><ul>${rows || "<li>Ingen aktivitet.</li>"}</ul>` +
        `<p><a href="${o.appUrl}/dashboard">Öppna Skermtime →</a></p>`,
    ),
  };
}
