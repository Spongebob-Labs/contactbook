import { Suspense } from "react";

import type { Metadata } from "next";

import { LoadingSkeleton } from "@/components/data/loading-skeleton";
import { ScreenStateRoot } from "@/components/data/screen-state-root";
import { loadCard } from "@/lib/api/loaders";
import type { ContactCard } from "@/types/domain";

import { CardDetailClient } from "./card-detail-client";

/**
 * `/cards/[cardId]` — the owner's view of one card (spec §6.1 R-12, §8D.3, plan T22).
 *
 * ## The two-file screen pattern, and why this half is a server component
 * `useFixture` reads `?state=` through `useSearchParams()`, which **requires a `<Suspense>`
 * boundary above it** or `next build` fails on prerender (plan §0.5). So the screen is a
 * pair: this server component owns routing, metadata and the not-found decision, and
 * `<CardDetailClient>` — a client component — owns the state switch, the single
 * `resolveCard` call and the render.
 *
 * ## Three Next 16 facts this file depends on
 * - **`params` is a `Promise`** and is awaited. A synchronous read is the single most common
 *   way a page written from memory fails to build here.
 * - **`PageProps<'/cards/[cardId]'>` is globally generated and must never be imported.**
 * - `generateMetadata` receives the same Promise-shaped props and runs for unknown ids too,
 *   so it must answer without throwing.
 *
 * ## Why the server reads the fixtures at all
 * The `?state=` switch is client-side by construction, but the *identity* of the card is not:
 * it is what the URL addresses, and an id that resolves to nothing has to reach the
 * not-found boundary rather than a client-side empty state (§11 E-36). So the server maps the
 * id to a `ContactCard` and hands that object down; everything that varies with `?state=` —
 * the profile the card filters, and therefore what it shares — comes through the gateway
 * inside the client view.
 *
 * ## Two things this file must not do
 * - **It renders no `<main>`.** `AppShell` owns the one `<main id="main">` for the whole
 *   `(app)` group; a second landmark fails axe's `landmark-unique` in T29 (AC-25).
 * - **It does not resolve the card.** `resolveCard` is called exactly once, in the client
 *   component, because the object it returns has to be the *same reference* the renderer,
 *   the `.vcf` and the PNG all receive (I-5, §6.4). Resolving here as well would be two
 *   objects that merely usually agree — the old build's bug, re-opened.
 *
 * ## `cardFontsClassName` belongs here, and only on routes like this one
 * This is a card route, so it opts the two card-only typefaces in (§8.4). It sits on a
 * wrapper *above* the card and is applied in this server component so the loader never
 * enters the client bundle. `/` and the `(auth)` group must **not** do this — AC-17 measures
 * those two bundles by name for exactly these faces.
 */

/** §11 E-36: the id is the whole input, and one that resolves to nothing is a panel. */
/**
 * The card, or `null`.
 *
 * Reads `GET /cards/{id}` rather than filtering a list, which makes the lookup a real
 * authorisation boundary: another owner's id returns `CARD_NOT_FOUND` and lands on the not-found
 * panel. Swallows every failure to `null` because `generateMetadata` also calls it and must
 * answer without throwing; the page body distinguishes missing from broken properly.
 */
async function cardById(cardId: string): Promise<ContactCard | null> {
  try {
    const loaded = await loadCard(cardId);
    return loaded?.card ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/cards/[cardId]">): Promise<Metadata> {
  const { cardId } = await params;
  const card = await cardById(cardId);

  // Reached for any unmatched id, because metadata is generated before the page runs. No
  // error code as a headline here either (§6.10).
  if (card === null) {
    return { title: "Card not found", description: "This card doesn't exist or was removed." };
  }

  return {
    title: card.name,
    // Nothing derived from the profile: a card's own name and type are the only facts this
    // route publishes that are not already on the public page.
    description: `Your ${card.name} card on Contact Book.`,
  };
}

/**
 * The `<Suspense>` fallback, and the same shape `loading.tsx` renders.
 *
 * §8D.3's card-detail row is specific: a **card-shaped skeleton plus five field-row
 * skeletons**, which is exactly what T10's `card-detail` variant draws. A generic block
 * would move the card sideways when it arrives.
 */
function CardDetailFallback() {
  return (
    <ScreenStateRoot
      state="loading"
      as="section"
      aria-label="Card detail"
      className="flex flex-col gap-8 pb-16"
    >
      <LoadingSkeleton variant="card-detail" label="Loading this card" />
    </ScreenStateRoot>
  );
}

export default async function CardDetailPage({ params }: PageProps<"/cards/[cardId]">) {
  const { cardId } = await params;
  return (
    <div>
      <Suspense fallback={<CardDetailFallback />}>
        <CardDetailClient cardId={cardId} />
      </Suspense>
    </div>
  );
}

