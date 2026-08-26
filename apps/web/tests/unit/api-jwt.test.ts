/**
 * `isAccessTokenStale` — the one-line reversal that fixed a redirect loop.
 *
 * ## The bug this file exists to prevent coming back
 * It used to return `false` for a token whose `exp` could not be read — "let the API be the
 * judge". That sounds humble and was wrong, because `proxy.ts` only rotates a *stale* token: an
 * unreadable `cb_at` was therefore never refreshed, the API rejected it on every request, and the
 * app bounced between `/dashboard` and `/signin/phone` forever with no way out but clearing
 * cookies by hand.
 *
 * Reproduced at the time with `curl -L -b "cb_at=not-a-real-token" /dashboard`, which hit the
 * 12-redirect ceiling and was still going.
 *
 * The cost of the fix is one wasted refresh against a token that might have been fine. The cost of
 * the old behaviour was an unusable app.
 */

import { describe, expect, it } from "vitest";

import { accessTokenExpiry, isAccessTokenStale } from "@/lib/api/jwt";

/** A JWT with the given payload. Unsigned — nothing here verifies signatures, by design. */
function token(payload: Record<string, unknown>): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe("accessTokenExpiry", () => {
  it("reads the exp claim", () => {
    expect(accessTokenExpiry(token({ exp: 1893456000 }))).toBe(1893456000);
  });

  it("returns null for anything it cannot read", () => {
    expect(accessTokenExpiry("not-a-jwt")).toBeNull();
    expect(accessTokenExpiry("only.two")).toBeNull();
    expect(accessTokenExpiry(token({ sub: "u1" }))).toBeNull(); // no exp
    expect(accessTokenExpiry("a.!!!not-base64!!!.c")).toBeNull();
    expect(accessTokenExpiry("")).toBeNull();
  });
});

describe("isAccessTokenStale", () => {
  it("is false for a token with plenty of life left", () => {
    expect(isAccessTokenStale(token({ exp: nowSeconds() + 3600 }))).toBe(false);
  });

  it("is true for an expired token", () => {
    expect(isAccessTokenStale(token({ exp: nowSeconds() - 60 }))).toBe(true);
  });

  it("is true inside the skew window, so a token cannot expire in flight", () => {
    // The race it closes: the token passes the check, spends 300ms on the wire, and arrives
    // already expired.
    expect(isAccessTokenStale(token({ exp: nowSeconds() + 30 }))).toBe(true);
    expect(isAccessTokenStale(token({ exp: nowSeconds() + 30 }), 0)).toBe(false);
  });

  it("⚠ is TRUE for an unreadable token — the reversal that broke the redirect loop", () => {
    // Returning false here meant proxy never rotated it, the API rejected it every time, and
    // `/dashboard` ⇄ `/signin/phone` looped forever. See the module note.
    expect(isAccessTokenStale("not-a-real-token")).toBe(true);
    expect(isAccessTokenStale("")).toBe(true);
    expect(isAccessTokenStale("a.b.c")).toBe(true);
    // A well-formed JWT that simply carries no expiry counts too: we cannot tell, so we try.
    expect(isAccessTokenStale(token({ sub: "u1" }))).toBe(true);
  });
});
