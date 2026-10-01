"use client";

import { useCallback, useRef } from "react";

import {
  EmptyState,
  ErrorPanel,
  LoadingSkeleton,
  ScreenStateRoot,
  resolveDataScreenState,
} from "@/components/data";
import { PageHeader } from "@/components/layout";
import { SendToPhone, type SendCardOption } from "@/components/share/send-to-phone";
import { cards, contacts, shareLinks } from "@/lib/api/browser";
import { toContact } from "@/lib/api/map";
import type { ShareLinkResponseDto } from "@/lib/api/schema";
import { useOptionalSession } from "@/lib/session-context";
import { useApiResource } from "@/lib/use-api";
import type { Contact } from "@/types/domain";

/**
 * The client half of `/share`. See `page.tsx` for why the screen exists.
 *
 * ## Three reads, and only the first is required
 * `GET /cards` is the question ("which card?"); without it there is nothing to send, so its
 * failure is the screen's error state. `GET /share-links` only picks the default card and
 * `GET /contacts` only feeds "Choose from contacts" — either failing degrades to "no default" /
 * "no picker", never to an error panel in front of a form that would still work.
 *
 * ## The default card
 * The card this owner sent most recently, else the first card. Someone at an event sends the
 * same card to person after person; making them re-pick it each time is the friction this screen
 * exists to remove.
 */

export interface QuickShareData {
  cards: SendCardOption[];
  defaultCardId: string | undefined;
  contacts: Contact[];
  /** `${cardId}:${contactId}` for every link that exists, so a repeat send can say so. */
  sentPairs: Set<string>;
}

/** The most recently minted link's card, among the cards still listed. Pure, for the test. */
export function mostRecentlySharedCardId(
  links: readonly Pick<ShareLinkResponseDto, "cardId" | "createdAt">[],
  cardIds: ReadonlySet<string>,
): string | undefined {
  let best: { cardId: string; createdAt: string } | undefined;
  for (const link of links) {
    if (!cardIds.has(link.cardId)) continue;
    if (best === undefined || link.createdAt > best.createdAt) best = link;
  }
  return best?.cardId;
}

async function loadQuickShare(ownerId: string): Promise<QuickShareData> {
  const [cardList, links, registry] = await Promise.all([
    cards.list(),
    shareLinks.list().catch(() => [] as ShareLinkResponseDto[]),
    contacts.list().catch(() => []),
  ]);

  const options = cardList.map((card) => ({ id: card.id, name: card.name }));
  const ids = new Set(options.map((option) => option.id));

  return {
    cards: options,
    defaultCardId: mostRecentlySharedCardId(links, ids),
    contacts: registry.map((dto) => toContact(dto, ownerId)),
    sentPairs: new Set(links.map((link) => `${link.cardId}:${link.contactId}`)),
  };
}

export function QuickShareSkeleton() {
  return (
    <ScreenStateRoot
      state="loading"
      as="section"
      aria-label="Send a card"
      className="mx-auto flex w-full max-w-[520px] flex-col gap-8 pb-16"
    >
      <PageHeader overline="Share" title="Send a card" />
      <LoadingSkeleton variant="form" label="Loading your cards" />
    </ScreenStateRoot>
  );
}

export function QuickShareClient() {
  const session = useOptionalSession();
  const ownerId = session?.user?.id ?? "";
  const load = useCallback(() => loadQuickShare(ownerId), [ownerId]);
  const result = useApiResource(load);
  const data = result.data ?? null;

  const screenState = resolveDataScreenState({
    state: result.state,
    isEmpty: data !== null && data.cards.length === 0,
  });

  /** Sends made on this screen since it loaded, so a second send to the same pair says so. */
  const sentThisVisit = useRef(new Set<string>());

  return (
    <ScreenStateRoot
      state={screenState}
      as="section"
      aria-label="Send a card"
      data-quick-share=""
      className="mx-auto flex w-full max-w-[520px] flex-col gap-8 pb-16"
    >
      <PageHeader overline="Share" title="Send a card" />

      {screenState === "loading" ? (
        <LoadingSkeleton variant="form" label="Loading your cards" />
      ) : null}

      {screenState === "error" || screenState === "offline" ? (
        <ErrorPanel error={result.error} headingLevel={2} onRetry={result.reload} />
      ) : null}

      {screenState === "empty" ? (
        <EmptyState
          headingLevel={2}
          title="You don't have a card yet"
          description="Make one, then come back to send it."
          action={{ label: "Create a card", href: "/cards/new" }}
        />
      ) : null}

      {screenState === "success" && data !== null ? (
        <SendToPhone
          cards={data.cards}
          defaultCardId={data.defaultCardId}
          contacts={data.contacts}
          alreadySent={(cardId, contactId) => {
            const pair = `${cardId}:${contactId}`;
            return data.sentPairs.has(pair) || sentThisVisit.current.has(pair);
          }}
          onSent={(minted, cardId) => {
            sentThisVisit.current.add(`${cardId}:${minted.contactId}`);
          }}
          autoFocus
        />
      ) : null}
    </ScreenStateRoot>
  );
}
