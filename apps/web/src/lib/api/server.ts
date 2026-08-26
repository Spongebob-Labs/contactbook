/**
 * The authenticated caller. Every endpoint function in `endpoints/` goes through here.
 *
 * ⚠ Server-only, and the `server-only` import makes that a build error rather than a
 * surprise: pulling this into a client component would bundle the API origin and the bearer
 * logic into browser JavaScript.
 *
 * Refresh is deliberately **not** here. A Server Component cannot set a cookie, so a
 * refresh performed at call time could not be persisted — the next request would refresh
 * again, forever. `middleware.ts` owns rotation, which means by the time any of this runs
 * the access token in the jar is already fresh.
 */

import "server-only";

import { ApiError } from "@/lib/api/errors";
import { readSession } from "@/lib/api/session";
import { transport, type TransportInit } from "@/lib/api/transport";

/** An authenticated call: the token is supplied here, never by the caller. */
type Call = Omit<TransportInit, "accessToken" | "refreshToken">;

/**
 * An unauthenticated call. Keeps `refreshToken`, because `POST /auth/refresh` is
 * unauthenticated in the bearer sense — it presents the refresh cookie instead, and is the
 * one endpoint that needs to pass it explicitly.
 */
type AnonCall = Omit<TransportInit, "accessToken">;

/**
 * A call that requires a session.
 *
 * Throws `UNAUTHENTICATED` locally when there is no token at all, rather than spending a
 * round trip to be told the same thing. `isSessionExpired` treats it identically either way.
 */
export async function authed<T>(init: Call): Promise<T> {
  const { accessToken } = await readSession();
  if (accessToken === null) {
    throw new ApiError({
      status: 401,
      code: "UNAUTHENTICATED",
      rawMessage: "No session cookie on this request.",
    });
  }
  return transport<T>({ ...init, accessToken });
}

/** A call that carries no bearer token — the two OTP endpoints, plus refresh. */
export async function anon<T>(init: AnonCall): Promise<T> {
  return transport<T>(init);
}

/** True when a session cookie exists. Cheap guard for layouts; not proof it is still valid. */
export async function hasSession(): Promise<boolean> {
  const { accessToken } = await readSession();
  return accessToken !== null;
}
