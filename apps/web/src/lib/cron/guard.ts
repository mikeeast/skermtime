// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}
