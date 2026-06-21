// Normalize a reported process name into a friendly label, e.g. "chrome.exe" → "Chrome".
export function normalizeAppName(raw: string): string {
  const base = raw.trim().replace(/\.exe$/i, "");
  if (!base) return "Okänt";
  return base.charAt(0).toUpperCase() + base.slice(1);
}
