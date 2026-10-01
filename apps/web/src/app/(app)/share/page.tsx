import type { Metadata } from "next";
import { Suspense } from "react";

import { QuickShareClient, QuickShareSkeleton } from "./quick-share-client";

/**
 * `/share` — the quick share: type a number, pick a card, send it on WhatsApp.
 *
 * Client review, 2026-09-28: *"Explore a fast 'meet and share' flow: user types a contact's phone
 * number … dropdown asks which card to share; sends the card link via WhatsApp to that number and
 * adds them to contacts … the phone-number-entry route should be the primary quick-share."* This
 * is the in-app half of that. The WhatsApp-bot half (typing the number into WhatsApp itself) is
 * backend-only and is not built here.
 *
 * The form is `<SendToPhone>` — the same component block (b) of `/cards/[cardId]` renders — so
 * the two routes cannot drift in what one press does: `POST /contacts` (the upsert that adds the
 * person to contacts), then `POST /cards/{id}/share`.
 *
 * Two-file shape for the usual reason: the client half reads `?state=` through
 * `useSearchParams()`, which needs a `<Suspense>` boundary above it or `next build` fails on
 * prerender. This file renders no `<main>` — `AppShell` owns the one landmark.
 */

export const metadata: Metadata = {
  title: "Send a card",
  description: "Send one of your cards to a phone number on WhatsApp.",
};

export default function SharePage() {
  return (
    <div>
      <Suspense fallback={<QuickShareSkeleton />}>
        <QuickShareClient />
      </Suspense>
    </div>
  );
}
