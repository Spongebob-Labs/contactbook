import type { Metadata } from "next";
import { Suspense } from "react";

import { ProfileClient, ProfileSkeleton } from "./profile-client";

/**
 * `/profile` — spec §6.1 R-16, §8D.3, plan T25.
 *
 * The server half of the two-file screen pattern (plan §0.5), and it owns exactly one thing: the
 * `<Suspense>` boundary. `ProfileClient` reads `?state=` through `useSearchParams()`, which
 * requires a boundary above it or `next build` fails on prerender.
 *
 * ⚠ **The fetch is deliberately not here.** It used to be — this page called `loadProfile()`
 * server-side and passed the result down as props. That worked, but the calls happened in Node, so
 * the browser's Network tab never showed them. They now happen client-side through `/api/cb/*`, so
 * every request and its exact response are inspectable from the browser.
 *
 * No `cardFontsClassName` here. `/profile` renders no `<ShareFace>`, and the two card-only
 * typefaces are scoped to the routes that do (AC-17 / N-3).
 *
 * `AppShell` (T09) already owns the main landmark this renders into, so there is no landmark and
 * no page padding here — a second one would double both.
 */

export const metadata: Metadata = {
  title: "Profile",
  description:
    "Your fields, grouped. A card is a filter over these — edit one field and every card that maps it changes.",
};

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileClient />
    </Suspense>
  );
}

