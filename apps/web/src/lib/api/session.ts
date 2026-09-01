/**
 * The session, as two first-party httpOnly cookies on **our** origin.
 *
 * ## Why we re-home the API's tokens instead of forwarding its cookies
 * `POST /auth/otp/verify` sets `cb_access_token` and `cb_refresh_token` scoped to
 * `apistaging.getcontactbook.com`. A browser on `localhost:3000` (or on the production web
 * origin) will not send those back — they are cross-site, so they would need
 * `SameSite=None; Secure`, and Safari's third-party cookie policy still discards them. That
 * is the classic way this integration fails on one device and works on another.
 *
 * So we do what the API's own docs suggest for non-browser clients: take `accessToken` out
 * of the **response body**, lift `cb_refresh_token` off the `Set-Cookie` header server-side,
 * and store both under our own names on our own origin. Every subsequent call is
 * server-to-server with an `Authorization: Bearer` header. No cross-site cookie exists
 * anywhere in the flow.
 *
 * ⚠ `writeSession` and `clearSession` can only be called from a Server Action or a Route
 * Handler — Next throws if a Server Component mutates cookies. Refresh therefore lives in
 * `middleware.ts`, which can.
 */

import { cookies } from "next/headers";

import { accessTokenExpiry } from "@/lib/api/jwt";
import {
  SESSION_ACCESS_COOKIE,
  SESSION_REFRESH_COOKIE,
} from "@/lib/api/config";

export interface Session {
  accessToken: string | null;
  refreshToken: string | null;
}

const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** `secure` off on localhost only — a `Secure` cookie is silently dropped over plain http. */
function secureFlag(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function readSession(): Promise<Session> {
  const jar = await cookies();
  return {
    accessToken: jar.get(SESSION_ACCESS_COOKIE)?.value ?? null,
    refreshToken: jar.get(SESSION_REFRESH_COOKIE)?.value ?? null,
  };
}

/**
 * Persist a new pair. `refreshToken` is optional because `POST /auth/refresh` rotates only
 * the access token in its body — passing `undefined` leaves the existing refresh cookie
 * alone rather than clearing it, which is the difference between a working rotation and
 * signing the user out every 15 minutes.
 */
export async function writeSession(accessToken: string, refreshToken?: string | null): Promise<void> {
  const jar = await cookies();
  const shared = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureFlag(),
    path: "/",
  };

  /* The cookie outlives the tab, bounded by the token's own `exp`.
     It used to have no `maxAge`, making it a session cookie — so closing the browser discarded it
     and the next visit had to rotate. Rotation is the one operation that can lose a session (the
     refresh token is single-use with family revocation), so doing it less often is worth a line.
     An unreadable token keeps the old session-cookie behaviour: better to re-rotate than to
     invent a lifetime. */
  const exp = accessTokenExpiry(accessToken);
  const maxAge = exp === null ? undefined : Math.max(0, Math.floor(exp - Date.now() / 1000));
  jar.set(SESSION_ACCESS_COOKIE, accessToken, maxAge === undefined ? shared : { ...shared, maxAge });

  if (refreshToken !== undefined && refreshToken !== null) {
    jar.set(SESSION_REFRESH_COOKIE, refreshToken, {
      ...shared,
      maxAge: REFRESH_MAX_AGE_SECONDS,
    });
  }
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_ACCESS_COOKIE);
  jar.delete(SESSION_REFRESH_COOKIE);
}

/**
 * Re-exported so callers have one import for "the session", while `middleware.ts` — which
 * cannot import this file, because `next/headers` is not available on the Edge runtime —
 * imports the same implementation directly from `jwt.ts`. One decoder, two entry points.
 */
export { accessTokenExpiry, isAccessTokenStale } from "@/lib/api/jwt";
