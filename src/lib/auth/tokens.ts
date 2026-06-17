import { randomBytes, createHash } from "crypto";

/**
 * Password-reset tokens. The raw token is emailed to the user; only its SHA-256
 * hash is stored, so a database leak does not expose usable reset links.
 */
export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes
