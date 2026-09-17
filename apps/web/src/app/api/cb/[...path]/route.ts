import { NextResponse, type NextRequest } from "next/server";

import {
  API_PREFIX,
  SESSION_ACCESS_COOKIE,
  SESSION_REFRESH_COOKIE,
  UPSTREAM_REFRESH_COOKIE,
  apiBaseUrl,
} from "@/lib/api/config";
import { accessTokenExpiry } from "@/lib/api/jwt";
import { findCookie, setCookieHeaders } from "@/lib/api/transport";
import { logApiCall } from "@/lib/api/log";

/**
 * A same-origin passthrough to the ContactBook API.
 *
 * `/api/cb/<anything>` → `<API_BASE_URL>/api/v1/<anything>`, verbatim in both directions.
 *
 * ## Why this exists
 * Every call used to be made server-side, which meant the browser's Network tab never showed one
 * — it showed Next.js's RSC payloads (`3:I["[project]/node_modules/…"`) instead. The API was
 * being called correctly the whole time, but there was **no way to see it from the browser**, and
 * being able to see it is a requirement, not a nicety: it is how the integration gets reviewed.
 *
 * ## What "verbatim" means here, precisely
 * - **Method, path and query** are forwarded unchanged.
 * - **The request body** is streamed through as-is. JSON stays JSON; `multipart/form-data` for
 *   `POST /profile/photo` stays multipart, boundary intact.
 * - **The response status is the API's status.** A 409 arrives in the browser as a 409.
 * - **The response body is the API's bytes**, not a re-serialisation. What Swagger shows is what
 *   the Network tab shows, character for character.
 * - **`x-request-id` is preserved**, so a line in the Network tab and a line in the API's own logs
 *   can be matched.
 *
 * Nothing is reshaped, renamed, defaulted or wrapped. If the two ever disagree, this file is
 * wrong — that is the whole contract.
 *
 * ## What is deliberately *not* passed through
 * **The access token never reaches the browser.** It lives in an httpOnly cookie this route reads
 * server-side and turns into an `Authorization: Bearer` header. That is the point of proxying
 * rather than letting the browser call the API directly: the API sets its cookies on *its* domain,
 * which a browser on our origin cannot send back (they are cross-site, so they would need
 * `SameSite=None; Secure`, and Safari discards them regardless). Direct browser calls would give
 * a session that works on one laptop and fails silently on the client's iPhone.
 *
 * So: the browser sees every request and every response. It never sees a credential.
 *
 * ## The two endpoints that are not pure passthrough, and why
 * Both still return the API's exact body — they only additionally manage *our* cookies:
 *
 * - `POST /auth/otp/verify` — the API's refresh token exists only as a `Set-Cookie` scoped to the
 *   API's domain. It is lifted out here and re-homed as a first-party cookie, or rotation is
 *   impossible later.
 * - `POST /auth/logout` — clears those same cookies once the API has revoked the family.
 */

/** Hop-by-hop and identity headers that must not be forwarded from the browser. */
const STRIPPED_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "content-length",
  // The browser's own cookies are ours, not the API's. The bearer is attached explicitly below.
  "cookie",
  "authorization",
]);

/**
 * Statuses the `Response` constructor refuses to pair with a body — **even an empty one.**
 *
 * ⚠ This is not a nicety. `upstream.arrayBuffer()` always yields an `ArrayBuffer`, and a
 * zero-length `ArrayBuffer` is still *a body* as far as undici is concerned: `new Response(new
 * ArrayBuffer(0), { status: 204 })` throws `Invalid response status code 204`. The throw happens
 * inside the route handler, so what the browser receives is a **500 with a Next error page** —
 * for a call the API answered successfully.
 *
 * Every `DELETE` in this API answers `204`, which is what made the failure so quiet: the record
 * really was deleted, the client saw a 5xx, showed a failure toast, and rolled its optimistic
 * update back — so the screen put the row, the photo or the logo *back* while the server no
 * longer had it, and a refresh showed the delete had worked all along.
 *
 * Found via `DELETE /cards/{id}/logo`, which is the first 204 this proxy had an assertion
 * standing behind (`tests/e2e/builder.spec.ts`). It was never specific to that route.
 *
 * `304` is here for completeness rather than observation: the fetch above sends no conditional
 * headers, so the API has nothing to answer it with.
 */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/** Headers the API sends that must not be replayed to the browser. */
const STRIPPED_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-encoding",
  "content-length",
  // The API's cookies are scoped to its own domain and are handled explicitly, never forwarded.
  "set-cookie",
]);

function upstreamUrl(request: NextRequest, path: string[]): string {
  const suffix = path.map((segment) => encodeURIComponent(segment)).join("/");
  const query = request.nextUrl.search;
  return `${apiBaseUrl()}${API_PREFIX}/${suffix}${query}`;
}

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  const method = request.method.toUpperCase();
  const url = upstreamUrl(request, path);
  const logPath = `/${path.join("/")}${request.nextUrl.search}`;
  const started = performance.now();

  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  }

  // The credential, attached server-side and never visible to the caller.
  const accessToken = request.cookies.get(SESSION_ACCESS_COOKIE)?.value;
  if (accessToken !== undefined) headers.set("authorization", `Bearer ${accessToken}`);

  // `POST /auth/refresh` reads the refresh token from a cookie rather than a header, and this is
  // a server-to-server call with no cookie jar — so it is handed over explicitly.
  const refreshToken = request.cookies.get(SESSION_REFRESH_COOKIE)?.value;
  if (refreshToken !== undefined && path.join("/") === "auth/refresh") {
    headers.set("cookie", `${UPSTREAM_REFRESH_COOKIE}=${refreshToken}`);
  }

  // Streamed rather than buffered, so a 20 MB photo upload does not sit in memory twice.
  const hasBody = method !== "GET" && method !== "HEAD";

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers,
      body: hasBody ? request.body : undefined,
      // Required by undici whenever a stream is used as a body.
      ...(hasBody ? { duplex: "half" as const } : {}),
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    logApiCall({ method, path: logPath, status: 0, durationMs: performance.now() - started, code: "NETWORK" });
    // Shaped like the API's own envelope so a caller has exactly one error shape to handle.
    return NextResponse.json(
      {
        statusCode: 502,
        code: "NETWORK",
        message: "Could not reach the API.",
        requestId: "",
      },
      { status: 502 },
    );
  }

  // Read as bytes: the body is returned unchanged rather than parsed and re-serialised, so what
  // the Network tab shows is what the API actually sent.
  const body = await upstream.arrayBuffer();

  const responseHeaders = new Headers();
  for (const [key, value] of upstream.headers) {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
  }

  const response = new NextResponse(NULL_BODY_STATUSES.has(upstream.status) ? null : body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });

  await manageSession(path, upstream, body, response);

  let code: string | undefined;
  if (!upstream.ok) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(body)) as { code?: unknown };
      if (typeof parsed.code === "string") code = parsed.code;
    } catch {
      code = "UNKNOWN";
    }
  }

  logApiCall({
    method,
    path: logPath,
    status: upstream.status,
    durationMs: performance.now() - started,
    requestId: upstream.headers.get("x-request-id"),
    code,
  });

  return response;
}

/**
 * Sign-in and sign-out are the only calls that touch our own cookies.
 *
 * The response body is untouched either way — this only adds `Set-Cookie` headers for our
 * first-party session, so the browser gets the API's exact JSON *and* a working session.
 */
async function manageSession(
  path: string[],
  upstream: Response,
  body: ArrayBuffer,
  response: NextResponse,
): Promise<void> {
  const route = path.join("/");
  const secure = process.env.NODE_ENV === "production";
  const shared = { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };

  /**
   * Store the access token with a lifetime taken from its own `exp`.
   *
   * Without a `maxAge` it is a session cookie, discarded when the browser closes — which forces a
   * rotation on the next visit. Rotation is the one operation that can lose a session (the refresh
   * token is single-use and its reuse revokes the family), so it is worth not provoking.
   */
  const setAccess = (token: string) => {
    const exp = accessTokenExpiry(token);
    const maxAge = exp === null ? undefined : Math.max(0, Math.floor(exp - Date.now() / 1000));
    response.cookies.set(
      SESSION_ACCESS_COOKIE,
      token,
      maxAge === undefined ? shared : { ...shared, maxAge },
    );
  };

  if (route === "auth/otp/verify" && upstream.ok) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(body)) as { accessToken?: unknown };
      if (typeof parsed.accessToken === "string") setAccess(parsed.accessToken);
    } catch {
      // A malformed success body is the API's problem; the response still passes through as-is.
    }

    const refresh = findCookie(setCookieHeaders(upstream), UPSTREAM_REFRESH_COOKIE);
    if (refresh !== null) {
      response.cookies.set(SESSION_REFRESH_COOKIE, refresh, {
        ...shared,
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return;
  }

  if (route === "auth/refresh" && upstream.ok) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(body)) as { accessToken?: unknown };
      if (typeof parsed.accessToken === "string") setAccess(parsed.accessToken);
    } catch {
      /* see above */
    }
    return;
  }

  if (route === "auth/logout") {
    response.cookies.delete(SESSION_ACCESS_COOKIE);
    response.cookies.delete(SESSION_REFRESH_COOKIE);
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return proxy(request, (await ctx.params).path);
}
