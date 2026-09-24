"use client";

/**
 * The access token, held client-side — **direct mode only.**
 *
 * ## Why this exists, and why it is not the default
 * In proxy mode the token lives in an httpOnly cookie the browser cannot read: safer, and nothing
 * needs this file. Direct mode cannot use that cookie, because the API sets it on its own domain
 * and a cross-origin request will not carry it. So direct mode authenticates the way the API's own
 * documentation describes for clients with "no cookie jar at all" — with the `accessToken` from
 * the `POST /auth/otp/verify` response body, sent as `Authorization: Bearer`.
 *
 * That token is then readable by any script running on the page. This is the accepted cost of a
 * browser-direct client and the reason proxy mode stays the default.
 *
 * ## `sessionStorage`, not `localStorage`
 * It dies when the tab closes, which bounds the exposure to one session. `localStorage` would
 * leave a bearer token on disk indefinitely for no gain here.
 */

const KEY = "cb.accessToken";

/** Never throws: private browsing and hardened settings can make storage unavailable. */
export function readAccessToken(): string | null {
  try {
    const fromStorage = window.sessionStorage.getItem(KEY);
    if (fromStorage) return fromStorage;
    const match = document.cookie.match(/(?:^|; )\s*(?:cb_at|cb_access_token)\s*=\s*([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function writeAccessToken(token: string): void {
  try {
    window.sessionStorage.setItem(KEY, token);
  } catch {
    // Storage unavailable. The call that needed it will 401, which surfaces as "sign in again" —
    // an honest outcome rather than a silent half-session.
  }
}

export function clearAccessToken(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear if storage is unavailable */
  }
}
