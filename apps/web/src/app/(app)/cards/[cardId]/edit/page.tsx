import { Suspense } from "react";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BuilderClient, BuilderSkeleton } from "@/components/builder";
import { ScreenStateRoot } from "@/components/data";
import { loadCard } from "@/lib/api/loaders";
import type { ContactCard } from "@/types/domain";

/**
 * `/cards/[cardId]/edit` — the card builder, opened on an existing card (spec §6.1 R-13,
 * §8D.4, plan T23).
 *
 * ## Three Next 16 facts this file depends on
 * - **`params` is a `Promise`** and is awaited. Reading it synchronously is the single most
 *   common way a page written from memory fails to build in this version.
 * - **`PageProps<'/cards/[cardId]/edit'>` is globally generated — never imported.**
 * - `generateMetadata` receives the same Promise-shaped props and runs for unknown ids too, so
 *   it has to answer without throwing.
 *
 * ## Why the server resolves the id at all
 * The `?state=` switch is client-side by construction, but *which card this is* is not — it is
 * what the URL addresses. Resolving it here means an unknown id reaches the not-found boundary
 * (§11 E-36) instead of a client-side empty state, and it means the builder's reducer is
 * initialised from a real card rather than from a fetch that never happens. Everything that
 * varies with `?state=` — the profile the card filters, and therefore what it shares — still
 * arrives through the gateway inside the client component.
 *
 * ## `notFound()` under a `loading.tsx`, measured
 * §6.1 R-13 requires a `loading.tsx`, a `loading.tsx` **is** a `<Suspense>` boundary around the
 * page, and this component is `async` — so React flushes the shell before the guard below runs.
 * Next documents the consequence in
 * `node_modules/next/dist/docs/.../file-conventions/loading.md`: once the response has streamed,
 * the status code cannot change, so what is served is the sanctioned soft 404 — `200` plus an
 * injected `<meta name="robots" content="noindex">` — carrying the nearest not-found panel.
 * `/c/[slug]` measured the same three alternatives and reached the same conclusion; the screen
 * the reader gets is a panel either way, which is what E-36 asks for.
 *
 * ## An existing card is never re-seeded
 * The builder applies a template's field preset only to a card that does not exist yet. Opening
 * this route and trying a different template changes what the card is *for* and leaves its five
 * mapped fields exactly where they are — replacing them with a two-field preset would be the
 * builder deleting the owner's card in front of them. The reducer owns that rule and
 * `tests/unit/builder-reducer.test.ts` is where it is pinned down.
 */

/** The id is the whole input, and an unknown one is a panel rather than a raw 404 (E-36). */
/**
 * The card, or `null`. Swallows failures because `generateMetadata` calls it and must answer
 * without throwing; the page body distinguishes missing from broken properly.
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
}: PageProps<"/cards/[cardId]/edit">): Promise<Metadata> {
  const { cardId } = await params;
  const card = await cardById(cardId);

  if (card === null) {
    // Reached for any unmatched id, because metadata is generated before the page runs.
    // No error code as a headline (§6.10).
    return { title: "Card not found" };
  }

  return {
    title: `Edit ${card.name}`,
    description: "Choose a template, tick the fields this card shares, and pick its colour.",
  };
}

export default async function EditCardPage({ params }: PageProps<"/cards/[cardId]/edit">) {
  const { cardId } = await params;

  return (
    <Suspense
      fallback={
        <ScreenStateRoot state="loading" className="flex flex-col gap-8 pb-16">
          <BuilderSkeleton />
        </ScreenStateRoot>
      }
    >
      <BuilderClient cardId={cardId} />
    </Suspense>
  );
}

/**
 * Fetch the card and the profile it picks from.
 *
 * Only a *successful* read that came back empty proves the id is unknown, so a transient API
 * failure becomes an error panel inside the builder rather than telling somebody their card was
 * deleted.
 */
