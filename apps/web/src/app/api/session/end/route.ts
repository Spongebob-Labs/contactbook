import { NextResponse, type NextRequest } from "next/server";

import { SESSION_ACCESS_COOKIE, SESSION_REFRESH_COOKIE } from "@/lib/api/config";

/**
 * Clear the session and go to sign-in.
 *
 * ## Why this route exists — it fixes a redirect loop
 * A Server Component **cannot set a cookie**. So when `(app)/layout.tsx` got a 401 it could only
 * `redirect("/signin/phone")` and leave the dead cookie in place — and `proxy.ts` bounces anyone
 * holding an access cookie away from `/signin/*` and back to `/dashboard`. The result was a hard
 * loop with no way out but clearing cookies by hand:
 *
 * ```
 * /dashboard      → layout gets 401 → /signin/phone
 * /signin/phone   → proxy sees cb_at → /dashboard
 * …forever
 * ```
 *
 * Reproduced before this existed: `curl -L -b "cb_at=not-a-real-token" /dashboard` hit the
 * 12-redirect ceiling and was still going.
 *
 * A **Route Handler** can set cookies, which is the whole reason this is a route and not a
 * function. Landing here deletes both cookies, so the very next request has no session at all and
 * `/signin/phone` renders normally.
 *
 * ## Why GET
 * `redirect()` from a Server Component issues a GET, so this has to answer one.
 *
 * ⚠ That makes it trivially reachable by a third party — an image tag pointing here would sign the
 * user out. Accepted knowingly: the worst outcome is an unwanted trip to the sign-in screen, no
 * data is touched, and the alternative (a POST with a token) cannot be reached from a
 * Server Component redirect at all. It is deliberately the *only* state-changing GET in the app.
 */

const SIGN_IN_PATH = "/signin/phone";

export async function GET(request: NextRequest) {
  const target = new URL(SIGN_IN_PATH, request.url);

  // Carried through so somebody kicked out of a deep link lands back on it after signing in.
  // Relative paths only: an absolute one would make this an open redirect.
  const next = request.nextUrl.searchParams.get("next");
  if (next !== null && next.startsWith("/") && !next.startsWith("//")) {
    target.searchParams.set("next", next);
  }

  const response = NextResponse.redirect(target);
  response.cookies.delete(SESSION_ACCESS_COOKIE);
  response.cookies.delete(SESSION_REFRESH_COOKIE);
  return response;
}
