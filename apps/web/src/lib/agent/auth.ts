import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "./token";

/**
 * Authenticate an agent request by its bearer device token.
 * Returns the admin client + device row, or null if unauthorized.
 */
export async function authDevice(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;

  const admin = createAdminClient();
  const { data: device } = await admin
    .from("devices")
    .select("*")
    .eq("token_hash", hashToken(token))
    .eq("revoked", false)
    .maybeSingle();

  return device ? { admin, device } : null;
}
