import type { BrowserContext, Page } from "@playwright/test";

/**
 * **Gives a browser context a session, so `(app)` routes render instead of redirecting.**
 *
 * ## Why a cookie and not a sign-in flow
 *
 * `proxy.ts` guards `/dashboard`, `/cards`, `/contacts`, `/profile` and `/signup`. Its check is
 * narrow and worth reading before touching this file: it looks for the `cb_at` cookie and asks
 * `isAccessTokenStale()`, which base64-decodes the `exp` claim and **verifies no signature** —
 * `jwt.ts` says so at the top, and is explicit that nothing there may ever decide whether a
 * request is authentic. Only the API does that.
 *
 * So a token with a future `exp` is all the proxy needs, and the e2e API stub accepts any
 * `Authorization` header. Driving the real OTP flow instead would add a six-digit code and a
 * WhatsApp send to the setup of every test on a gated screen, to prove something
 * `auth-flow.spec.ts` already proves once.
 *
 * ⚠ **This is a harness affordance and must never be reachable from application code.** It
 * forges nothing the API would accept: the stub is what makes it useful, and against a real API
 * this token is rejected on the first call.
 *
 * ## ⚠ WHY IT IS OPT-IN AND NOT `storageState` ON EVERY PROJECT
 *
 * A session cookie applied globally would break the suites that need its absence, silently and
 * confusingly. `proxy.ts` redirects a request **holding** an access cookie away from
 * `/signin/*` to `/dashboard` — so `auth-flow.spec.ts` would find the dashboard everywhere it
 * expected a phone-number form, which is exactly the failure this whole harness change exists
 * to remove, mirrored. Signed-in-ness is a property of a test, so a test asks for it.
 */

/** Ten years out. Long enough that a stale snapshot never expires mid-suite. */
const TEN_YEARS_S = 10 * 365 * 24 * 60 * 60;

const b64url = (value: string): string =>
  Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * A JWT-shaped string with a readable `exp`.
 *
 * Three segments because `accessTokenExpiry` returns `null` — and `isAccessTokenStale` therefore
 * returns `true` — for anything that does not `split(".")` into exactly three parts. The
 * signature segment is a constant: nothing in the browser or in the stub reads it.
 */
export function fixtureAccessToken(expiresInSeconds = TEN_YEARS_S): string {
  const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      sub: "e2e-fixture-user",
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    }),
  );
  return `${header}.${payload}.e2e`;
}

/**
 * Sign the context in.
 *
 * ⚠ Call it on the **context**, before the first navigation. A cookie set after `goto` arrives
 * too late for the redirect that already happened, and the test then reports the sign-in screen
 * as a missing element.
 *
 * ⚠ `cb_refresh_token` is deliberately absent. With no refresh cookie the proxy never attempts
 * a rotation, which keeps the harness clear of `POST /auth/refresh` and of the reuse-detection
 * stampede its own note warns about — and the access token above never goes stale anyway.
 */
export async function signIn(context: BrowserContext, baseURL: string): Promise<void> {
  const { hostname } = new URL(baseURL);
  await context.addCookies([
    {
      name: "cb_at",
      value: fixtureAccessToken(),
      domain: hostname,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

/** `signIn` for a spec that only has the `page` fixture to hand. */
export async function signInPage(page: Page, baseURL: string): Promise<void> {
  await signIn(page.context(), baseURL);
}
