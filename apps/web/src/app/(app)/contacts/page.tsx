import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ContactsListClient, ContactsListSkeleton } from "./contacts-list-client";

/**
 * `/contacts` — the recipient registry (spec §6.1 R-14, §8D.3, §4.6, plan T24).
 *
 * ⚠ The fetch is **not** here. It used to be, and the calls were therefore invisible to the
 * browser's Network tab; they now happen client-side through `/api/cb/*`. This file owns two
 * things:
 *
 * 1. **The `<Suspense>` boundary.** `ContactsListClient` reads `?q=`, `?source=` and `?state=`
 *    through `useSearchParams()`, which requires a boundary above it or `next build` fails on
 *    prerender.
 * 2. **The page heading.** It sits *outside* the boundary on purpose: the title of the page does
 *    not depend on the data, so it should never be a skeleton and never move.
 *
 * No subtitle (2026-09-28). It explained what a contact is to the person whose contacts these
 * are; the client asked for that kind of line to go. The buttons under the header say what can
 * be done here.
 *
 * There is no `<main>` here. `AppShell` (T09) renders the single `<main id="main">` that every
 * `(app)` screen renders into, and a second landmark fails `landmark-unique` (AC-25).
 *
 * **The card-only font wrapper is deliberately absent.** Neither contacts screen draws a
 * `<ShareFace>`, and the two card typefaces are opted in only by the routes that do (§8.4).
 */

export const metadata: Metadata = {
  title: "Contacts",
  description: "People you can send a card to.",
};

export default function ContactsPage() {
  return (
    <div className="flex flex-col gap-8 pb-16">
      <PageHeader title="Contacts" />

      <Suspense fallback={<ContactsListSkeleton />}>
        <ContactsListClient />
      </Suspense>
    </div>
  );
}

