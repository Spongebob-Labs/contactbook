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
export function fixtureAccessToken(expiresInSeconds = TEN_YEARS_S, sub = DEFAULT_SUB): string {
  const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + expiresInSeconds }),
  );
  return `${header}.${payload}.e2e`;
}

/**
 * The default identity. Every spec that does not ask for its own gets this one, and the stub
 * serves it straight from the fixture snapshot with writes echoed and discarded — the behaviour
 * the whole suite was written against.
 */
const DEFAULT_SUB = "e2e-fixture-user";

/**
 * A `sub` that gives this test **its own mutable copy of the fixture world** in the e2e stub.
 *
 * ## ⚠ Why a test would want one, and why it is not the default
 *
 * The stub normally accepts writes and discards them, so "change it, reload, it is still there"
 * cannot be asserted — which is exactly what has to be asserted about the card's design columns,
 * since the entire point of `coverUrl`/`headline`/`bio`/the seven axes becoming real columns is
 * that they survive a reload. `tests/stubs/state.mjs` grows a real store for callers that opt in.
 *
 * It is opt-in because Playwright runs `fullyParallel` across three viewport projects against
 * **one** stub process. Persisted writes visible to everyone would turn 22 existing spec files
 * into a race — one reading a card another had just renamed. Keying the store on `sub` makes
 * each test's world private.
 *
 * ⚠ **The label must be unique per test, and the random suffix is what makes it so across the
 * three viewport projects.** The same test body runs three times concurrently; without it, all
 * three would share a partition and the third would read the first's cards.
 */
export function statefulSub(label: string): string {
  return `e2e-state-${label}-${Math.random().toString(36).slice(2, 10)}`;
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
export async function signIn(
  context: BrowserContext,
  baseURL: string,
  options?: { sub?: string },
): Promise<void> {
  const { hostname } = new URL(baseURL);
  await context.addCookies([
    {
      name: "cb_at",
      value: fixtureAccessToken(undefined, options?.sub),
      domain: hostname,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

/** `signIn` for a spec that only has the `page` fixture to hand. */
export async function signInPage(
  page: Page,
  baseURL: string,
  options?: { sub?: string },
): Promise<void> {
  await signIn(page.context(), baseURL, options);
}
