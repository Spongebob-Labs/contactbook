/**
 * Where the browser sends API calls: **straight to the deployed API**, or through the
 * same-origin proxy.
 *
 * ## Why there are two modes at all
 * Direct is what you want — the Network tab then shows
 * `https://apistaging.getcontactbook.com/api/v1/profile/me`, the real deployed URL, exactly as
 * Swagger addresses it. Nothing in between.
 *
 * It is **not currently possible**, and the reason is on the API side. Measured against staging:
 *
 * ```
 * OPTIONS /api/v1/profile/me   Origin: http://localhost:3000
 * → 204, with access-control-allow-credentials / -headers / -methods
 * → but NO access-control-allow-origin
 * ```
 *
 * and from the browser console:
 *
 * ```
 * Access to fetch at 'https://apistaging.getcontactbook.com/api/v1/profile/me'
 * from origin 'http://localhost:3000' has been blocked by CORS policy:
 * No 'Access-Control-Allow-Origin' header is present on the requested resource.
 * ```
 *
 * No `Access-Control-Allow-Origin` means the browser throws the response away before any code
 * sees it. Every origin tried was refused, including the production and staging web hosts — so it
 * is not localhost being singled out; browser access is simply not enabled on that deployment.
 *
 * ## The one change that unlocks it
 * The API already supports this. `main.ts` does
 * `app.enableCors({ origin: allowedOrigins, credentials: true })`, where `allowedOrigins` comes
 * from the **`CORS_ORIGIN`** environment variable — and its built-in fallback list already
 * contains `http://localhost:3000`. Since staging emits no header at all, `CORS_ORIGIN` is set on
 * that deployment to a value that does not include the web origin.
 *
 * Add the frontend origin to `CORS_ORIGIN` on the staging deploy, then set
 * `NEXT_PUBLIC_API_DIRECT=1` here. Nothing else changes: same client, same endpoints, same DTOs —
 * only the base URL, and the Network tab starts showing the deployed link.
 *
 * ## What direct mode costs
 * Cookies cannot cross origins, so direct mode authenticates with `Authorization: Bearer` using
 * the `accessToken` the API returns in the `POST /auth/otp/verify` body — a path its own docs
 * describe for clients with "no cookie jar at all". That token has to live somewhere the browser
 * can read, which means it is reachable by any script on the page, unlike the httpOnly cookie
 * proxy mode uses. That is the standard trade-off for a browser-direct client, and the reason
 * proxy mode remains the default rather than a fallback.
 */

/** True when the browser should call the deployed API directly. */
export function isDirectMode(): boolean {
  return process.env.NEXT_PUBLIC_API_DIRECT === "1";
}

/**
 * The deployed API origin, for direct mode.
 *
 * `NEXT_PUBLIC_` because the browser needs it. In proxy mode the origin stays server-only and is
 * never published — one more reason proxy mode is the default.
 */
export function publicApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://apistaging.getcontactbook.com"
  ).replace(/\/+$/, "");
}

/**
 * What the browser prefixes every path with.
 *
 * - direct: `https://apistaging.getcontactbook.com/api/v1`
 * - proxy:  `/api/cb`
 */
export function browserApiBase(): string {
  return isDirectMode() ? `${publicApiBaseUrl()}/api/v1` : "/api/cb";
}
