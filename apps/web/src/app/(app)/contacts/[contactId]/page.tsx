import type { Metadata } from "next";
import { Suspense } from "react";

import { loadContact } from "@/lib/api/loaders";
import { contactLabel } from "@/types/domain";

import {
  ContactBackLink,
  ContactDetailClient,
  ContactDetailSkeleton,
} from "./contact-detail-client";

/**
 * `/contacts/[contactId]` — one recipient (spec §6.1 R-15, §8D.3, plan T24).
 *
 * ## Three Next 16 facts this file depends on (plan §0.4)
 * - **`params` is a `Promise`** and is awaited. A synchronous read is the single most common way
 *   a page written from memory fails to build in this version.
 * - **`PageProps<'/contacts/[contactId]'>` is globally generated and never imported.**
 * - `generateMetadata` receives the same Promise-shaped props and runs for unknown ids too, so it
 *   answers without throwing.
 *
 * ## What changed when the API arrived
 * The id used to be looked up in `fixtureContacts`. It is now `GET /contacts/{id}`, which makes
 * the lookup a real authorisation boundary: somebody else's contact id returns
 * `CONTACT_NOT_FOUND` and lands on the not-found panel, rather than being absent from a list.
 *
 * ⚠ The page body no longer fetches: the client does, through `/api/cb/*`, so the calls are
 * visible in the Network tab. `generateMetadata` still reads server-side — it has to, because it
 * runs before any client code — and an unknown id becomes the screen's own not-found panel rather
 * than the boundary.
 *
 * ## The soft 404, and why it is correct rather than a compromise
 * `loading.tsx` on this route is a Suspense boundary, so Next flushes the shell before
 * `notFound()` runs and the response is already committed at 200. Next's documented behaviour is
 * then to inject `<meta name="robots" content="noindex">` and render `not-found.tsx`. §11 is
 * explicit that the reader must never meet a raw 404, and the crawler gets the half of the answer
 * that matters to it. Same ruling as R-18 (D11).
 *
 * There is no `<main>` here: `AppShell` (T09) owns the single one. The card-only font wrapper is
 * absent too — this route draws no card (§8.4, AC-17 / N-3).
 */

export async function generateMetadata({
  params,
}: PageProps<"/contacts/[contactId]">): Promise<Metadata> {
  const { contactId } = await params;

  // Swallowed to `null`: metadata generation must answer without throwing, so a transient API
  // failure titles the tab "Contact not found" rather than crashing the render.
  let label: string | null = null;
  try {
    const loaded = await loadContact(contactId);
    label = loaded === null ? null : contactLabel(loaded.contact);
  } catch {
    label = null;
  }

  if (label === null) {
    return { title: "Contact not found" };
  }

  // The name and nothing else. A contact's number is data the owner holds privately, so it is
  // never composed into a description (§7.3, §13.1).
  return { title: label, description: "A contact you can send a card to." };
}

export default async function ContactDetailPage({ params }: PageProps<"/contacts/[contactId]">) {
  const { contactId } = await params;

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Outside the boundary: the way back never waits for data, and it is the one thing that
          must still work in every state (§8D.1 — what succeeded still renders). */}
      <ContactBackLink />

      <Suspense fallback={<ContactDetailSkeleton />}>
        <ContactDetailClient contactId={contactId} />
      </Suspense>
    </div>
  );
}

