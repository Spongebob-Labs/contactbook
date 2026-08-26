/**
 * Token rotation and the route guard.
 *
 * ⚠ **`proxy.ts`, not `middleware.ts`.** The `middleware` file convention is deprecated in
 * Next 16 and renamed to `proxy`; the exported function must be named `proxy` (or be the
 * default export). Same capabilities, different name —
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
 *
 * ## Why rotation lives here, given the docs say to avoid Proxy where possible
 * A Server Component cannot set a cookie — Next throws if it tries. So a refresh performed
 * inside a data read could obtain a new access token but never persist it, and every
 * subsequent request would refresh again, forever. Proxy is the only place in the App Router
 * that can both *see* a stale cookie and *write* its replacement onto the outgoing response.
 * That is the "no other option exists" case the docs reserve this for.
 *
 * The consequence is worth stating plainly: by the time any Server Component or Server Action
 * runs, the access token in the jar is already fresh. `server.ts` therefore carries no retry
 * logic, and needs none.
 *
 * ## Why the guard is here too
 * `(app)` routes had no guard in the fixture build — deliberately, since there was no session
 * to check (§7.2). Now there is one, and the check belongs above the render rather than inside
 * each layout, so an unauthenticated request never begins rendering a dashboard it will not be
 * allowed to finish.
 */

import { NextResponse, type NextRequest } from "next/server";

import { isAccessTokenStale } from "@/lib/api/jwt";
import {
  API_PREFIX,
  SESSION_ACCESS_COOKIE,
  SESSION_REFRESH_COOKIE,
} from "@/lib/api/config";

/**
 * Prefixes that require a session.
 *
 * `/signup` is in here, which is easy to misread as a bug. It is not: onboarding is an
 * *authenticated* call. A user reaches `/signup/first-name` only after `POST /auth/otp/verify`
 * has already created their account and minted a session, so arriving there without one means
 * something went wrong and the answer is to start at the phone screen.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/cards", "/contacts", "/profile", "/signup"] as const;

/** Signing in again is pointless when a session already exists — these bounce to the app. */
const SIGN_IN_PREFIX = "/signin";

const SIGN_IN_PATH = "/signin/phone";
const APP_HOME = "/dashboard";

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => matches(pathname, prefix));
}

/**
 * `/signin/phone`, carrying where they were headed.
 *
 * `next` is a query parameter rather than a cookie so that a shared link cannot silently redirect
 * somebody to a page they never asked for.
 */
function signInUrl(request: NextRequest, pathname: string, search: string): URL {
  const target = request.nextUrl.clone();
  target.pathname = SIGN_IN_PATH;
  target.search = "";
  target.searchParams.set("next", `${pathname}${search}`);
  return target;
}

/**
 * The outcome of a rotation attempt.
 *
 * The distinction between `rejected` and `unreachable` is load-bearing, and collapsing them was a
 * bug: a **rejected** refresh means the session is genuinely dead and the cookies must go, while
 * an **unreachable** API means we simply do not know — and signing somebody out because their
 * wifi dropped is the wrong answer.
 */
type Rotation =
  | { kind: "rotated"; accessToken: string }
  /** The API answered, and said no: expired, unknown, or reuse-detected. The session is over. */
  | { kind: "rejected" }
  /** We never got an answer. Keep whatever access token we already had. */
  | { kind: "unreachable" };

async function rotate(refreshToken: string): Promise<Rotation> {
  const base = (process.env.API_BASE_URL ?? "https://apistaging.getcontactbook.com").replace(
    /\/+$/,
    "",
  );
  try {
    const response = await fetch(`${base}${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        // The API reads the refresh token from this cookie. We hold it first-party and hand it
        // back explicitly, because a server-to-server call has no cookie jar.
        Cookie: `cb_refresh_token=${refreshToken}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return { kind: "rejected" };
    const body = (await response.json()) as { accessToken?: unknown };
    return typeof body.accessToken === "string"
      ? { kind: "rotated", accessToken: body.accessToken }
      : // A 200 with no token is a contract break, not a live session.
        { kind: "rejected" };
  } catch {
    return { kind: "unreachable" };
  }
}

/**
 * Requests that must **never** trigger a rotation here.
 *
 * ## The bug this prevents, in the API's own words
 * `POST /auth/refresh`: *"Reusing an already-rotated token revokes the whole token family
 * (REFRESH_REUSE_DETECTED), not just the presented token."*
 *
 * One page load fires **four concurrent** API calls (`/profile/me`, `/auth/me`, `/profile/fields`,
 * `/profile/groups`). Proxy runs on each. With a stale access token, all four attempted a refresh
 * with the same refresh token: the first rotated it, the other three presented a consumed token,
 * and the API revoked the entire family — signing the user out on **every single load**. That is
 * precisely the "I have to enter my number every time" symptom.
 *
 * So rotation happens only on **document navigations**, which arrive one at a time. An API call
 * that meets an expired token gets a 401, and the browser client refreshes **once** (deduplicated
 * behind a single shared promise — see `browser.ts`) and retries.
 */
function isApiCall(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const access = request.cookies.get(SESSION_ACCESS_COOKIE)?.value ?? null;
  const refresh = request.cookies.get(SESSION_REFRESH_COOKIE)?.value ?? null;

  /**
   * ⚠ `!isApiCall(pathname)` is the fix for the refresh stampede — see `isApiCall`. Without it,
   * concurrent API calls race to rotate one single-use token and the API revokes the family.
   */
  const needsRotation =
    !isApiCall(pathname) && refresh !== null && (access === null || isAccessTokenStale(access));

  let rotated: string | null = null;
  /**
   * Whether the session is known to be over.
   *
   * Two ways to be certain: the API rejected the refresh token, or the access token is stale and
   * there is no refresh token to trade in. Either way the cookies are dead weight — and leaving
   * them in place is what caused the loop, because `proxy` bounces anyone *holding* an access
   * cookie away from `/signin/*`.
   *
   * An unreachable API is deliberately **not** in this set: not knowing is not the same as no.
   */
  let sessionDead = false;

  if (needsRotation) {
    const outcome = await rotate(refresh);
    if (outcome.kind === "rotated") rotated = outcome.accessToken;
    else if (outcome.kind === "rejected") sessionDead = true;
  } else if (
    !isApiCall(pathname) &&
    access !== null &&
    refresh === null &&
    isAccessTokenStale(access)
  ) {
    // A stale access token and nothing to renew it with. Nothing to try; it is over.
    sessionDead = true;
  }

  const effectiveAccess = sessionDead ? null : (rotated ?? access);

  // ── A session we know is over: clear it, wherever they are ──────────────────────────
  // Before anything else, because every branch below reads better once the cookies are gone —
  // and because this is the branch that ends the loop.
  // An API call is never redirected: its caller is `fetch`, which would follow the redirect and
  // receive an HTML sign-in page where it expected JSON. It gets the API's own 401 instead, which
  // the client already knows how to handle.
  if (sessionDead && isApiCall(pathname)) {
    const response = NextResponse.next();
    response.cookies.delete(SESSION_ACCESS_COOKIE);
    response.cookies.delete(SESSION_REFRESH_COOKIE);
    return response;
  }

  if (sessionDead) {
    // Redirect only when they were trying to reach something that needs a session. A dead cookie
    // discovered while reading the marketing page is not a reason to demand a sign-in — the
    // cookies go, the page renders, and nothing interrupts them.
    const response = isProtected(pathname)
      ? NextResponse.redirect(signInUrl(request, pathname, search))
      : NextResponse.next();

    response.cookies.delete(SESSION_ACCESS_COOKIE);
    response.cookies.delete(SESSION_REFRESH_COOKIE);
    return response;
  }

  // ── Already signed in, standing on a sign-in screen ─────────────────────────────────
  if (effectiveAccess !== null && matches(pathname, SIGN_IN_PREFIX)) {
    // `(app)/layout.tsx` sends them back to `/signup` if onboarding is unfinished, so this
    // redirect cannot strand a half-set-up account on a dashboard it cannot render.
    return NextResponse.redirect(new URL(APP_HOME, request.url));
  }

  // ── The guard ───────────────────────────────────────────────────────────────────────
  if (!isApiCall(pathname) && isProtected(pathname) && effectiveAccess === null) {
    const redirect = NextResponse.redirect(signInUrl(request, pathname, search));
    // Rotation just failed while a refresh token was present: it is spent. Clear it, or every
    // later request pays for a round trip that cannot succeed.
    if (refresh !== null) {
      redirect.cookies.delete(SESSION_ACCESS_COOKIE);
      redirect.cookies.delete(SESSION_REFRESH_COOKIE);
    }
    return redirect;
  }

  if (rotated === null) return NextResponse.next();

  // ── Publish the rotated token, in both directions ───────────────────────────────────
  //
  // Two writes, and both are needed. Skipping either is why a refresh appears to "take one
  // reload to work":
  //
  // 1. On the *request*, so the render happening on this very pass reads the new token. The
  //    docs are explicit that this must go through `NextResponse.next({ request: { headers } })`
  //    — mutating `request.cookies` alone does not reach the application, and
  //    `next({ headers })` (without the `request` wrapper) sends them to the client instead.
  // 2. On the *response*, so the browser stores it for next time.
  request.cookies.set(SESSION_ACCESS_COOKIE, rotated);
  const forwarded = new Headers(request.headers);
  forwarded.set("cookie", request.cookies.toString());

  const response = NextResponse.next({ request: { headers: forwarded } });
  response.cookies.set(SESSION_ACCESS_COOKIE, rotated, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}

export const config = {
  /**
   * Everything except Next's internals and static files. Without a matcher, Proxy runs on
   * *every* request including `_next/static` and `public/` assets — so an image request would
   * pay for a cookie read and could trigger a duplicate token rotation, which is a real and
   * genuinely confusing source of double refresh calls.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)",
  ],
};
