import type { CSSProperties } from "react";
import { redirect } from "next/navigation";

import { SkipLink } from "@/components/layout/skip-link";
import { ToastProvider } from "@/components/overlay";
import { isApiError } from "@/lib/api/errors";
import { loadOnboardingCompleted, loadUser } from "@/lib/api/loaders";
import { SessionProvider } from "@/lib/session-context";

/**
 * The `(onboarding)` route group — the first-run walkthrough at `/welcome`, where a new owner
 * finishes the card the API made for them before they ever see the dashboard.
 *
 * ## The same gate as `(app)`, and deliberately not the same chrome
 * It applies `(app)/layout.tsx`'s two checks through the same memoised reads: there must be a
 * session (a 401 goes through `/api/session/end`, which can clear a dead cookie where a Server
 * Component cannot), and that session must belong to a finished profile (anything else goes back
 * to `/signup/first-name`). The walkthrough edits the card `POST /profile/onboarding` created, so
 * a profile that has not been through it has no card to edit.
 *
 * What it does NOT take from `(app)` is the shell. No sidebar, no bottom bar: this is a focus
 * route with one object on it, and a nav rail beside it would offer six ways out of a flow whose
 * only job is to get one card finished. The page renders its own header with the one way out
 * ("Skip setup").
 *
 * ⚠ `proxy.ts` does not list `/welcome` among its protected prefixes, so an anonymous request
 * reaches this layout instead of being bounced at the edge. That is safe — the 401 branch below
 * sends it to sign-in, carrying `next` — but it is one render later than `(app)` routes get.
 *
 * ── Mounts ──────────────────────────────────────────────────────────────────────────
 * · `ToastProvider` — the failure toasts, and the overlay elevation sheet the crop dialog needs
 *   (see `AppChrome`'s note: without it portalled overlays render flat).
 * · `SkipLink` — first in the tab order, to the `<main id="main">` below.
 * · The app chrome's face (`--font-app`), set here because `[data-app-shell]` — where
 *   `globals.css` normally applies it — is `AppShell`'s, and this group does not render one. The
 *   card pins its own `--font-sans` on its root, so this cannot reach it.
 */
export default async function OnboardingGroupLayout({ children }: LayoutProps<"/">) {
  let user: Awaited<ReturnType<typeof loadUser>>;
  let onboarded: boolean;

  try {
    [user, onboarded] = await Promise.all([loadUser(), loadOnboardingCompleted()]);
  } catch (thrown) {
    if (isApiError(thrown) && thrown.status === 401) redirect("/api/session/end?next=/welcome");
    throw thrown;
  }

  if (!onboarded) redirect("/signup/first-name");

  return (
    <SessionProvider user={user}>
      <ToastProvider>
        <SkipLink />
        <div
          data-onboarding-shell=""
          className="flex min-h-full flex-1 flex-col bg-canvas text-ink"
          style={
            {
              fontFamily: "var(--font-app)",
              "--font-display": "var(--font-app)",
            } as CSSProperties
          }
        >
          <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
            {children}
          </main>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
