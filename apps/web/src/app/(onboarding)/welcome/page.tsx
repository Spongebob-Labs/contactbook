import { Suspense } from "react";
import type { Metadata } from "next";

import { WelcomeClient } from "@/components/onboarding/welcome-client";

/**
 * `/welcome` — where a new owner lands after `/signup/done`: the card onboarding made, shown
 * big, edited in place in three skippable steps. See `components/onboarding/welcome-client.tsx`.
 *
 * The two-file screen pattern: the walkthrough reads `?step=` (and `useApiResource` reads
 * `?state=`) through `useSearchParams`, which needs a `<Suspense>` boundary above it or
 * `next build` fails on prerender. The fallback is `null` rather than a second skeleton because
 * the client renders its own, in the walkthrough's exact shape, the moment it mounts.
 *
 * It renders no `<main>`: `(onboarding)/layout.tsx` owns the one landmark.
 */

export const metadata: Metadata = {
  title: "Set up your card",
  robots: { index: false },
};

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <WelcomeClient />
    </Suspense>
  );
}
