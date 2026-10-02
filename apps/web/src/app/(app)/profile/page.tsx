import type { Metadata } from "next";
import { Suspense } from "react";

import { ProfileClient, ProfileSkeleton } from "./profile-client";

/**
 * `/profile` — Profile & Cards, the one workspace for fields and the cards built from them.
 *
 * The server half of the two-file screen pattern, and it owns exactly one thing: the
 * `<Suspense>` boundary. `ProfileClient` reads `?state=` and `?card=` through
 * `useSearchParams()`, which requires a boundary above it or `next build` fails on prerender.
 *
 * The fetch is deliberately not here: it happens client-side through `/api/cb/*`, so every
 * request and its response are inspectable from the browser.
 *
 * `AppShell` already owns the main landmark this renders into, so there is no landmark and no
 * page padding here — a second one would double both.
 */

export const metadata: Metadata = {
  title: "Profile & Cards",
  description: "Your fields and the cards that share them.",
};

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileClient />
    </Suspense>
  );
}
