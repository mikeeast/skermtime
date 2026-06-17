import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client that BYPASSES RLS. Server-only — use exclusively for
 * trusted server contexts that have no authenticated user (Strava/Stripe
 * webhooks, the agent's device-token endpoints). Never import from client code.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
