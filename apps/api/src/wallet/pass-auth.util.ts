import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Derives the authenticationToken for a pass: base64url(HMAC-SHA256(secret, serialNumber)).
 * Must be ≥16 chars — Apple rejects shorter tokens.
 *
 * The secret is non-rotatable once passes ship: rotating it strands every
 * installed pass that cached the old token (they become unverifiable until the
 * owner re-adds the pass).
 */
export function deriveAuthToken(secret: string, serialNumber: string): string {
  return createHmac('sha256', secret).update(serialNumber).digest('base64url');
}

/** Constant-time comparison to prevent timing oracle on the token. */
export function verifyAuthToken(
  secret: string,
  serialNumber: string,
  provided: string,
): boolean {
  const expected = deriveAuthToken(secret, serialNumber);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}
