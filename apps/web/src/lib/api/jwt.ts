/**
 * Unverified JWT inspection. Pure — no `next/headers`, no `server-only` — because
 * `middleware.ts` runs on the Edge runtime and cannot import either.
 *
 * ⚠ Nothing here verifies a signature, and nothing here may ever be used to decide whether a
 * request is authentic. Only the API does that. These functions answer one narrow question:
 * "is this token worth sending, or should we rotate first?" A forged `exp` can therefore
 * only ever cause an unnecessary refresh, which is harmless.
 */

/** The `exp` claim in epoch seconds, or `null` when the token is unreadable. */
export function accessTokenExpiry(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[1] === undefined) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const decoded = JSON.parse(globalThis.atob(padded)) as { exp?: unknown };
    return typeof decoded.exp === "number" ? decoded.exp : null;
  } catch {
    return null;
  }
}

/**
 * True when the token is expired, within `skewSeconds` of it, **or unreadable**.
 *
 * The 60s skew closes the race where a token passes this check, spends 300ms in flight, and
 * arrives at the API already expired.
 *
 * ⚠ An unreadable token counts as stale, which is a reversal. It used to return `false` — "let the
 * API be the judge" — and that was wrong in a way that produced a redirect loop: a malformed or
 * truncated `cb_at` was never rotated, the API rejected it on every request, and the app bounced
 * between `/dashboard` and `/signin/phone` forever.
 *
 * Treating it as stale costs one refresh attempt against a token that might have been fine. That
 * is a far cheaper mistake than a session nobody can escape.
 */
export function isAccessTokenStale(token: string, skewSeconds = 60): boolean {
  const exp = accessTokenExpiry(token);
  if (exp === null) return true;
  return Date.now() / 1000 >= exp - skewSeconds;
}
