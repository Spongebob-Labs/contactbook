import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout";

import { DashboardClient, DashboardSkeleton } from "./dashboard-client";

/**
 * `/dashboard` — spec §6.1 R-09, §8D.3, §4.4 step 1.
 *
 * The server half of the mandatory two-file screen pair (plan §0.5). It owns exactly two
 * things and hands the rest to the client:
 *
 * 1. **The `<Suspense>` boundary.** `DashboardClient` reads `?state=` through
 *    `useSearchParams()`, which requires a boundary above it or `next build` fails on
 *    prerender. That is the entire reason this screen is split in two.
 *
 * 2. **The page `<h1>`.** `PageHeader` renders it at `--text-h3` with a hairline
 *    beneath (§8D.3's page-header pattern), and it sits *outside* the boundary so the
 *    title is already on screen while the body below it is still a set of bones. Every
 *    heading in the client therefore starts at `h2`.
 *
 * `AppShell` (T09) supplies the one `<main id="main">` and the content max-width, so this
 * file adds no ground, no width cap and no top padding of its own — a second allowance
 * here would push the title down the page.
 *
 * **The card-only typefaces are deliberately not opted in here.** The dashboard renders
 * one `thumb`, and a `thumb` is a miniature: T13's frame resolves `typeFamily` through
 * `var(--font-archivo, …)` with a real fallback stack, so the tile renders correctly
 * without pulling two card-route-only typefaces into an authenticated bundle that holds no
 * `full`-mode card at all (AC-17, N-3). Card routes opt in; this one has nothing to gain.
 */

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your cards, the contacts saved from them, and the profile fields they draw on.",
};

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your cards, the people who saved them, and the profile fields they draw on."
      />

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardClient />
      </Suspense>
    </>
  );
}
