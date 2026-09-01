import { Suspense } from "react";
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { OverlayStyles } from "@/components/overlay";
import { Skeleton } from "@/components/primitives";
import { AuthFlowProvider } from "@/lib/auth-flow-context";

/**
 * The `(auth)` route group — six screens, one question each (spec §8D.2).
 *
 * `LayoutProps<"/">` is the **globally generated** helper and is never imported (plan §0.4).
 * The route is `/` because a route group contributes no URL segment.
 *
 * One title covers all six screens because the pages are client components — a `'use
 * client'` module cannot export `metadata` — and because the six are one flow, not six
 * destinations. Nobody bookmarks step 4.
 *
 * ── Three mounts, and why each is here ───────────────────────────────────────────────
 *
 * · **`AuthFlowProvider`** — the in-memory answers (§10.1). It is mounted *here*, above the
 *   pages, which is the entire mechanism behind E-46: the router does not remount a layout
 *   when it moves between that layout's own pages, so Back cannot destroy a value. Move
 *   this into a page and the flow forgets everything on every step.
 *
 * · **`<OverlayStyles />`** — load-bearing, not boilerplate. T08 ships the `[data-elevation]`
 *   rule inside a React 19 hoisted `<style href precedence>` that only overlay components
 *   render, and `(app)`'s `ToastProvider` keeps it resident on authenticated routes. This
 *   group renders no overlay, but `country-select.tsx` portals T05's `<Select>` menu with
 *   `data-elevation="1"` and — correctly — carries no lift of its own, because F-09 keeps
 *   every such rule inside `src/components/overlay/**`. **Without this line the country
 *   dropdown renders flat against the page**, with no visible connection to this file.
 *   `components/overlay/index.ts` names this as the one manual step in that contract.
 *
 * · **`<Suspense>`** — every step reads `?state=` through `useSearchParams`, which requires
 *   a boundary above it or `next build` fails on prerender (plan §0.4, §0.5). One boundary
 *   here rather than six in the pages: T16 owns exactly one file per auth route, and a
 *   boundary in the layout covers all six identically. The fallback is a layout-matched
 *   skeleton, never a spinner (§8D.1).
 *
 * ── The guard, now that there is a real session ──────────────────────────────────────
 *
 * Not here, but it exists. `proxy.ts` owns both halves, and they point in opposite directions:
 *
 * · `/signin/*` is **open**, and redirects *away* to `/dashboard` when a session already exists
 *   — signing in again is not a thing anyone wants.
 * · `/signup/*` is **protected**, which reads like a mistake and is not. Onboarding is an
 *   authenticated call: `POST /auth/otp/verify` has already created the account and minted a
 *   session by the time step three renders, so arriving at `/signup/first-name` without one
 *   means the flow broke and the answer is to start at the phone screen.
 *
 * A real OTP is sent (`POST /auth/otp/request`), a real session is minted on verify, and the
 * profile is created on the email step. The confirmation screen submits nothing.
 */

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Contact Book, or make an account in six short steps.",
};

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthFlowProvider>
      <OverlayStyles />
      <AuthShell>
        <Suspense fallback={<AuthStepSkeleton />}>{children}</Suspense>
      </AuthShell>
    </AuthFlowProvider>
  );
}

/**
 * The step's own box, held open: question, helper, one control, one button. It occupies the
 * same vertical space the real step will, so the column does not jump when it arrives.
 */
function AuthStepSkeleton() {
  return (
    <div data-auth-step-skeleton="" aria-busy="true" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-4/5 rounded-sm" />
        <Skeleton variant="text" className="w-3/5" />
      </div>
      <Skeleton className="h-10 w-full rounded-sm" />
      <Skeleton className="h-13 w-40 rounded-md" />
    </div>
  );
}
