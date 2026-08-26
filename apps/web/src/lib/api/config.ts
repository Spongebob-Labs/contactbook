/**
 * Where the API is, and how long we wait for it.
 *
 * `API_BASE_URL` is read **server-side only** and is deliberately not `NEXT_PUBLIC_`: the
 * browser never talks to the API directly (see `server.ts` for why), so publishing the
 * origin to the client would advertise an attack surface nothing uses.
 */

const DEFAULT_BASE_URL = "https://apistaging.getcontactbook.com";

/**
 * Trailing slashes are stripped so `join()` can assume exactly one separator. A base URL
 * ending in `/` is the single most common cause of a `//api/v1/...` 404.
 */
export function apiBaseUrl(): string {
  const raw = process.env.API_BASE_URL ?? DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

/** Every path in this client is written relative to here, so the version bumps in one place. */
export const API_PREFIX = "/api/v1";

/**
 * 15s. Long enough for a cold serverless start on staging, short enough that a hung request
 * surfaces as "that took too long" rather than a spinner nobody ever sees end.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

/** The API's own cookie names, which we read off its `Set-Cookie` and then manage ourselves. */
export const UPSTREAM_ACCESS_COOKIE = "cb_access_token";
export const UPSTREAM_REFRESH_COOKIE = "cb_refresh_token";

/** Our first-party cookies on the web origin. Short names keep the header small. */
export const SESSION_ACCESS_COOKIE = "cb_at";
export const SESSION_REFRESH_COOKIE = "cb_rt";

export function join(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl()}${API_PREFIX}${suffix}`;
}
