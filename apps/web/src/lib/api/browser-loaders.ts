"use client";

/**
 * The composed reads each screen needs, made from the browser.
 *
 * Mirrors `loaders.ts` (which is server-side, for the initial render) using the same pure mappers
 * from `map.ts` — so the domain shapes are identical whichever side fetched them. Only the
 * transport differs.
 *
 * Every function here is **stable at module scope**, deliberately: `useApiResource` re-runs its
 * read whenever the function identity changes, so an inline arrow would refetch forever. Loaders
 * that need an argument return a memoisable closure the caller wraps in `useCallback`.
 */

import { auth, cards, contacts, profile, shareLinks } from "@/lib/api/browser";
import type { AudienceRecipientDto } from "@/lib/api/schema";
import { isApiError } from "@/lib/api/errors";
import {
  groupSharesByContact,
  toContact,
  toContactCard,
  toContactShare,
  toProfile,
  toUser,
} from "@/lib/api/map";
import {
  contactLabel,
  type CardShareRow,
  type Contact,
  type ContactCard,
  type ContactShare,
} from "@/types/domain";

/* ── profile ─────────────────────────────────────────────────────────────────────────── */

/**
 * `GET /profile/me` + `GET /auth/me` + `GET /profile/fields` + `GET /profile/groups`.
 *
 * Four calls, concurrently — four rows in the Network tab. The flat field list and the group list
 * rather than `/profile/me` alone, because `MeResponseDto` has no bucket for `CUSTOM` and folds
 * `IDENTITY` into a flat object, so a profile assembled from it can silently omit fields.
 */
export async function fetchProfileData() {
  const [me, identity, fields, groups] = await Promise.all([
    profile.me(),
    authMe(),
    profile.listFields(),
    profile.listGroups(),
  ]);

  const user = toUser(me, identity.id);
  const mapped = toProfile(fields, groups, user.id);
  return { user, groups: mapped.groups, fields: mapped.fields };
}

/* ── contacts ────────────────────────────────────────────────────────────────────────── */

/** `GET /contacts` + `GET /share-links`, joined into a per-contact count. */
export async function fetchContactsData() {
  const [me, identity, list] = await Promise.all([profile.me(), authMe(), contacts.list()]);
  const user = toUser(me, identity.id);
  const mapped = list.map((dto) => toContact(dto, user.id));

  let shareCounts: Record<string, number> = {};
  try {
    const links = await shareLinks.list();
    shareCounts = Object.fromEntries(
      [...groupSharesByContact(links)].map(([contactId, shares]) => [contactId, shares.length]),
    );
  } catch {
    // Losing the "cards sent" column beats losing the registry.
    shareCounts = {};
  }

  return { contacts: mapped, shareCounts };
}

/** One contact and every card sent to them. `null` when the id is unknown (404). */
export function fetchContactDetail(contactId: string) {
  return async (): Promise<{ contact: Contact; shares: ContactShare[] } | null> => {
    const [me, identity] = await Promise.all([profile.me(), authMe()]);
    const user = toUser(me, identity.id);

    let dto;
    try {
      dto = await contacts.get(contactId);
    } catch (thrown) {
      if (isApiError(thrown) && thrown.code === "CONTACT_NOT_FOUND") return null;
      throw thrown;
    }

    let shares: ContactShare[] = [];
    try {
      shares = groupSharesByContact(await shareLinks.list()).get(contactId) ?? [];
    } catch {
      shares = [];
    }

    return { contact: toContact(dto, user.id), shares };
  };
}

/* ── cards ───────────────────────────────────────────────────────────────────────────── */

/** Cards **and** the profile they filter — a card owns no data (§5.3). */
export async function fetchCardsData() {
  const [{ user, groups, fields }, list] = await Promise.all([fetchProfileData(), cards.list()]);
  return { user, groups, fields, cards: list.map((dto) => toContactCard(dto, user.id)) };
}

/** One card, its profile, its share links (with recipient names), and the registry to send to. */
export function fetchCardDetail(cardId: string) {
  return async () => {
    const { user, groups, fields } = await fetchProfileData();

    let dto;
    try {
      dto = await cards.get(cardId);
    } catch (thrown) {
      if (isApiError(thrown) && thrown.code === "CARD_NOT_FOUND") return null;
      throw thrown;
    }

    let registry: Contact[] = [];
    try {
      const list = await contacts.list();
      registry = list.map((c) => toContact(c, user.id));
    } catch {
      registry = [];
    }

    /**
     * Who can be notified, and how far behind each is.
     *
     * ⚠ **`audience` is authoritative, not an enrichment.** This used to build the rows from
     * `GET /share-links` and merely look versions up here — which silently dropped any recipient
     * the audience knew about but that list did not return, and a dropped recipient is one the
     * owner cannot notify at all. The two endpoints are now unioned by `shareLinkId`, so a
     * disagreement adds a row rather than losing one.
     *
     * A failure degrades to "no notification data": the card must still render its recipients.
     */
    let currentVersion = 0;
    let audienceByLinkId = new Map<string, AudienceRecipientDto>();
    try {
      const audience = await cards.audience(cardId);
      currentVersion = audience.currentVersion;
      audienceByLinkId = new Map(audience.recipients.map((r) => [r.shareLinkId, r]));
    } catch {
      audienceByLinkId = new Map();
    }

    let shares: CardShareRow[] = [];
    try {
      const byId = new Map(registry.map((c) => [c.id, c]));
      /** The registry's name for a contact, else whatever the API called them, else the number. */
      const labelFor = (contactId: string, displayName: string | null, phone: string): string => {
        const contact = byId.get(contactId);
        return contact !== undefined ? contactLabel(contact) : (displayName ?? phone);
      };

      const rows = (await shareLinks.list())
        .filter((link) => link.cardId === cardId)
        .map((link) => {
          /* Absent for a revoked link — `audience` lists ACTIVE only. `null` rather than 0, so
             the picker can tell "caught up" from "cannot be notified at all". */
          const seen = audienceByLinkId.get(link.id);
          return {
            ...toContactShare(link),
            contactId: link.contactId,
            contactLabel: labelFor(link.contactId, link.contactDisplayName, link.contactPhoneE164),
            versionsBehind: seen?.versionsBehind ?? null,
            lastNotifiedVersion: seen?.lastNotifiedVersion ?? null,
          } satisfies CardShareRow;
        });

      /* Anyone the audience lists that the share-link list did not return. Normally none — but
         "normally none" is exactly the assumption that hid a missing recipient, so it is
         reconciled rather than trusted. These rows carry no `url`/`createdAt` of their own, so
         they are built from what the audience itself provides. */
      const known = new Set(rows.map((r) => r.shareLinkId));
      const orphans: CardShareRow[] = [...audienceByLinkId.values()]
        .filter((r) => !known.has(r.shareLinkId))
        .map((r) => ({
          shareLinkId: r.shareLinkId,
          cardId,
          cardName: dto.name,
          url: "",
          status: "ACTIVE" as const,
          viewCount: r.viewCount,
          firstViewedAt: null,
          lastViewedAt: r.lastViewedAt,
          createdAt: new Date(0).toISOString(),
          contactId: r.contactId,
          contactLabel: labelFor(r.contactId, r.contactDisplayName, r.contactPhoneE164),
          versionsBehind: r.versionsBehind,
          lastNotifiedVersion: r.lastNotifiedVersion,
        }));

      shares = [...rows, ...orphans]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      shares = [];
    }

    const card: ContactCard = toContactCard(dto, user.id);
    return { user, groups, fields, card, shares, contacts: registry, currentVersion };
  };
}

/** `POST /auth/me`. Named so the four loaders that need the user id read the same way. */
function authMe() {
  return auth.me();
}

/* ── dashboard ───────────────────────────────────────────────────────────────────────── */

/**
 * Everything the dashboard reads — from the API, and only from the API.
 *
 * ⚠ This screen used to run entirely on `useFixture`, so it reported the fixture set's 9 cards,
 * 8 contacts and 35 fields to every owner regardless of their real data, and rendered a card
 * whose link pointed at `card.example`. Numbers on a dashboard are read as facts; inventing them
 * is worse than showing nothing.
 *
 * The audience reads are per-card and therefore N calls. They are `allSettled` and strictly
 * optional: a card whose audience fails contributes nothing rather than failing the screen, and
 * `behind` stays `null` — "we do not know" — rather than collapsing to a confident 0.
 */
export async function fetchDashboardData() {
  const [{ user, groups, fields }, cardDtos, contactDtos, linkDtos] = await Promise.all([
    fetchProfileData(),
    cards.list(),
    contacts.list().catch(() => []),
    shareLinks.list().catch(() => []),
  ]);

  const mappedCards = cardDtos.map((dto) => toContactCard(dto, user.id));

  const settled = await Promise.allSettled(
    mappedCards.map(async (card) => ({ cardId: card.id, audience: await cards.audience(card.id) })),
  );
  const behindByCardId = new Map<string, number>();
  let anyAudience = false;
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    anyAudience = true;
    behindByCardId.set(
      result.value.cardId,
      result.value.audience.recipients.filter((r) => r.versionsBehind > 0).length,
    );
  }

  return {
    user,
    groups,
    fields,
    cards: mappedCards,
    contacts: contactDtos.map((c) => toContact(c, user.id)),
    links: linkDtos.map((l) => ({
      cardId: l.cardId,
      contactId: l.contactId,
      status: l.status,
      viewCount: l.viewCount,
      createdAt: l.createdAt,
    })),
    behindByCardId,
    /* `null`, not 0, when every audience call failed — see the note above. */
    behind: anyAudience ? [...behindByCardId.values()].reduce((a, b) => a + b, 0) : null,
  };
}
