// Pure parsers for the family earning settings form. Kept separate so they are
// trivially unit-testable and the server action stays thin.

/**
 * Parse the optional daily screen-time cap field.
 * Empty string → null (no cap). Non-numeric → null. Otherwise a non-negative int.
 */
export function parseDailyCap(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.trunc(n));
}

/**
 * Parse minutes-per-km. Non-numeric → fallback. Clamped to [0, 600].
 */
export function parseMinutesPerKm(raw: string, fallback = 10): number {
  const trimmed = raw.trim();
  if (trimmed === "") return fallback; // Number("") is 0, so guard empty explicitly.
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(600, Math.max(0, Math.trunc(n)));
}
