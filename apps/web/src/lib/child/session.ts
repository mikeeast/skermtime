import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Server-only secret used to sign the lightweight child session token + hash PINs.
const SECRET = process.env.SUPABASE_SECRET_KEY ?? "skermtime-dev-secret";

/** Signed token `<childId>.<hmac>` stored in the child session cookie. */
export function signChildToken(childId: string): string {
  const sig = createHmac("sha256", SECRET).update(childId).digest("base64url");
  return `${childId}.${sig}`;
}

export function verifyChildToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const childId = token.slice(0, dot);
  const expected = createHmac("sha256", SECRET).update(childId).digest("base64url");
  const a = Buffer.from(token.slice(dot + 1));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return childId;
}

/** Salted scrypt hash, stored as `salt:hash`. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(pin, salt, 32).toString("hex");
  const a = Buffer.from(test);
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}
