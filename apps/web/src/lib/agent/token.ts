import { createHash, randomBytes } from "node:crypto";

/** SHA-256 hex of a device token (only the hash is stored server-side). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A long, random device bearer token. */
export function newDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

/** A 6-digit pairing code the parent reads out to the agent. */
export function newPairingCode(): string {
  return String((randomBytes(4).readUInt32BE(0) % 900000) + 100000);
}
