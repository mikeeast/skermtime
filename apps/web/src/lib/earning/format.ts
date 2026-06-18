/** Human-friendly minutes: 240 -> "4 h", 90 -> "1 h 30 min", 45 -> "45 min". */
export function formatMinutes(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return "0 min";
  const t = Math.round(total);
  const h = Math.floor(t / 60);
  const m = t % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
