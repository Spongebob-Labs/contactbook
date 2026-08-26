/**
 * The one place a `fetch` to the API happens.
 *
 * Everything above this file works in typed domain terms and never sees a `Response`;
 * everything this file touches is HTTP. That split is what makes the error taxonomy
 * enforceable — there is exactly one function that can turn a non-2xx into an exception,
 * so there is exactly one place a raw API message could leak past.
 *
 * ⚠ Server-only. It reads `API_BASE_URL` and attaches bearer tokens; importing it into a
 * client component would ship both to the browser. `server.ts` is the only caller.
 */

import { ApiError, narrowCode, parseErrorEnvelope } from "@/lib/api/errors";
import { REQUEST_TIMEOUT_MS, join } from "@/lib/api/config";
import { logApiCall } from "@/lib/api/log";

export interface TransportInit {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Path relative to `/api/v1` — `"/cards"`, not `"/api/v1/cards"`. */
  path: string;
  /** Serialized as JSON. Mutually exclusive with `form`. */
  body?: unknown;
  /** For `POST /profile/photo`, which is `multipart/form-data`. */
  form?: FormData;
  query?: Record<string, string | number | boolean | undefined>;
  /** Sent as `Authorization: Bearer`. */
  accessToken?: string | null;
  /**
   * Sent as a literal `Cookie: cb_refresh_token=…` header. Only `POST /auth/refresh` needs
   * this, because the refresh token is cookie-only on the API and we hold it ourselves.
   */
  refreshToken?: string | null;
  /** Next's fetch cache directive. Reads that must not be cached pass `"no-store"`. */
  cache?: RequestCache;
}

/** What a successful call returns. `null` for the five `204 No Content` endpoints. */
export type TransportResult<T> = T;

/**
 * A successful call, plus the raw `Set-Cookie` strings from the response.
 *
 * Only `POST /auth/otp/verify` needs the headers — it is the one endpoint whose `Set-Cookie`
 * carries something we must keep (`cb_refresh_token`). Everything else uses {@link transport},
 * which drops them. Both go through the same code path, so there is still exactly one place
 * that can turn a non-2xx into an `ApiError`.
 */
export interface RawResult<T> {
  data: T;
  setCookies: string[];
}

/** The query as it will be sent, for the log line. Empty when nothing survives. */
function queryString(query: NonNullable<TransportInit["query"]>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded.length === 0 ? "" : `?${encoded}`;
}

function buildUrl(path: string, query: TransportInit["query"]): string {
  const url = new URL(join(path));
  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Perform the call, keeping the response's `Set-Cookie` strings.
 *
 * @throws {ApiError} on any non-2xx, on a network failure, on a timeout, and on a 2xx whose
 * body is not the JSON it claimed to be. Callers therefore only ever handle the happy path
 * plus `ApiError` — never a `Response`, never a bare `unknown`.
 */
export async function transportRaw<T>(init: TransportInit): Promise<RawResult<T>> {
  const { method, path, body, form, query, accessToken, refreshToken, cache } = init;

  // Logged on every exit path below. The browser cannot see these calls — they are
  // server→server — so this terminal line is the only place the integration is observable.
  const started = performance.now();
  const logged = `${path}${query === undefined ? "" : queryString(query)}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  // Set explicitly rather than via a cookie jar: this is a server-to-server call, so there
  // is no jar, and the API reads the refresh token from exactly this cookie name.
  if (refreshToken) headers.Cookie = `cb_refresh_token=${refreshToken}`;

  // `AbortSignal.timeout` rather than a manual setTimeout + controller: it cannot leak a
  // timer, which the hand-rolled version does on every early return.
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: cache ?? "no-store",
      redirect: "manual",
    });
  } catch (cause) {
    const timedOut =
      cause instanceof DOMException && (cause.name === "TimeoutError" || cause.name === "AbortError");
    const code = timedOut ? "TIMEOUT" : "NETWORK";
    logApiCall({
      method,
      path: logged,
      status: 0,
      durationMs: performance.now() - started,
      code,
    });
    throw new ApiError({
      status: 0,
      code,
      rawMessage: cause instanceof Error ? cause.message : "fetch failed",
    });
  }

  const requestId = response.headers.get("x-request-id");

  // 204 is a documented success on five endpoints (field delete, reorder, group delete,
  // photo delete, card archive). Reading a body there would throw on empty input.
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    if (response.ok) {
      logApiCall({
        method,
        path: logged,
        status: response.status,
        durationMs: performance.now() - started,
        requestId,
      });
      return { data: null as T, setCookies: setCookieHeaders(response) };
    }
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      // A non-JSON body on a 2xx is a contract break; on a non-2xx it is usually an
      // infrastructure page (a gateway 502 in HTML). Both become one honest error.
      const code = response.ok ? "MALFORMED" : "UNKNOWN";
      logApiCall({
        method,
        path: logged,
        status: response.status,
        durationMs: performance.now() - started,
        requestId,
        code,
      });
      throw new ApiError({
        status: response.status,
        code,
        rawMessage: `Non-JSON response (${response.status})`,
        requestId,
      });
    }
  }

  if (response.ok) {
    logApiCall({
      method,
      path: logged,
      status: response.status,
      durationMs: performance.now() - started,
      requestId,
    });
    return { data: parsed as T, setCookies: setCookieHeaders(response) };
  }

  const envelope = parseErrorEnvelope(parsed);
  const code = envelope === null ? "UNKNOWN" : narrowCode(envelope.code);
  logApiCall({
    method,
    path: logged,
    status: response.status,
    durationMs: performance.now() - started,
    requestId: envelope?.requestId ?? requestId,
    // The API's own code, even when it is one we do not recognise — the whole point of a log
    // line is to show what actually came back, not what we made of it.
    code: envelope?.code ?? code,
  });
  throw new ApiError({
    status: response.status,
    code,
    rawMessage: envelope?.message ?? `Request failed with ${response.status}`,
    requestId: envelope?.requestId ?? requestId,
    details: envelope?.details,
  });
}

/**
 * The call every endpoint function makes. Discards the response headers.
 *
 * @throws {ApiError} — see {@link transportRaw}.
 */
export async function transport<T>(init: TransportInit): Promise<TransportResult<T>> {
  const { data } = await transportRaw<T>(init);
  return data;
}

/**
 * Find one cookie's value among raw `Set-Cookie` header strings.
 *
 * Pure, and takes the strings rather than a `Response`, for two reasons. It is trivially
 * testable in any environment — browser-like runtimes treat `set-cookie` as a forbidden
 * response header and filter it out of `Headers`, so a `Response`-shaped signature is
 * untestable under happy-dom. And it keeps the parsing separate from the extraction, which
 * is the part that differs between runtimes.
 *
 * Used for exactly one thing: lifting `cb_refresh_token` out of the `POST /auth/otp/verify`
 * response. The API's cookie is httpOnly and scoped to the API's domain, so a browser on our
 * origin could never see it — the token has to be re-homed server-side or refresh is
 * impossible.
 */
export function findCookie(setCookieHeaders: readonly string[], name: string): string | null {
  for (const entry of setCookieHeaders) {
    if (entry.length === 0) continue;
    // Split on commas that begin a new `key=` pair, so an `Expires=Wed, 01 Jan…` date inside
    // one cookie is not mistaken for a separator between two.
    for (const part of entry.split(/,(?=[^;]+?=)/)) {
      const [pair] = part.trimStart().split(";");
      if (pair === undefined) continue;
      const eq = pair.indexOf("=");
      if (eq < 1) continue;
      if (pair.slice(0, eq).trim() === name) return pair.slice(eq + 1).trim();
    }
  }
  return null;
}

/** The runtime-specific half: get the raw `Set-Cookie` strings off a real `Response`. */
export function setCookieHeaders(response: Response): string[] {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const single = response.headers.get("set-cookie");
  return single === null ? [] : [single];
}
