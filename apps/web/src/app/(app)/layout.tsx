import { redirect } from "next/navigation";

import { AppChrome } from "@/components/layout/app-chrome";
import { isApiError } from "@/lib/api/errors";
import { loadOnboardingCompleted, loadUser } from "@/lib/api/loaders";
/**
 * The `(app)` route group — the authenticated product (spec §8D.3). The group name is omitted
 * from the URL, so this layout nests inside the single root layout and wraps `/dashboard`,
 * `/cards/**`, `/contacts/**` and `/profile/**`.
 *
 * `LayoutProps<"/">` is the **globally generated** helper — never imported (plan §0.4). The
 * route path is `/` because a route group contributes no URL segment.
 *
 * ── What changed when the API arrived ────────────────────────────────────────────────
 *
 * This layout used to be synchronous and mount `FixtureAuthProvider`, whose own header said it
 * was "not a security boundary" and that `(app)` routes "render for anyone, by design". Both
 * are now false, and this file is where that stopped being true:
 *
 * · It is `async`, and fetches the signed-in user server-side.
 * · It owns the **onboarding gate**. `proxy.ts` proves there is a session; only this can prove
 *   the session belongs to a finished profile. Both checks are needed and neither substitutes
 *   for the other — a user who verified an OTP and closed the tab has a perfectly valid session
 *   and no name, and every screen below here assumes a name.
 *
 * The chrome itself — providers, skip link, shell — lives in `<AppChrome>`, so that composition
 * and tab order stay unit-testable while this file does the I/O. See its header.
 */
export default async function AppGroupLayout({ children }: LayoutProps<"/">) {
  // Both reads go through `loaders.ts`, which memoises them for this request — so a screen
  // below that needs the same user or the same profile costs no second round trip.
  let user: Awaited<ReturnType<typeof loadUser>>;
  let onboarded: boolean;

  try {
    [user, onboarded] = await Promise.all([loadUser(), loadOnboardingCompleted()]);
  } catch (thrown) {
    // `proxy.ts` already rotated and guarded, so reaching here means the token died between that
    // check and this render — a narrow race, but a real one on an expiring session.
    //
    // ⚠ It goes to `/api/session/end`, **not** straight to `/signin/phone`. A Server Component
    // cannot clear a cookie, and redirecting to sign-in while still holding a dead `cb_at` is
    // exactly the loop that route exists to break: proxy bounces anyone with an access cookie
    // away from `/signin/*` and back here. The Route Handler deletes the cookies first.
    if (isApiError(thrown) && thrown.status === 401) redirect("/api/session/end");
    throw thrown;
  }

  // The gate. `POST /profile/onboarding` is one-shot and requires a name and an email, so a
  // session without a completed profile can only go one place.
  if (!onboarded) redirect("/signup/first-name");

  return <AppChrome user={user}>{children}</AppChrome>;
}
