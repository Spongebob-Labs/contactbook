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

import { auth, cards, contacts, dashboard, profile, shareLinks } from "@/lib/api/browser";
import type { AudienceRecipientDto } from "@/lib/api/schema";
import { isApiError } from "@/lib/api/errors";
import { formatPhoneDisplay } from "@/lib/format";
import {
  groupSharesByContact,
  toContact,
  toContactCard,
  toContactShare,
  toProfile,
  toUser,
} from "@/lib/api/map";
import { readDashboardSummary } from "@/lib/dashboard/metrics";
import {
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

  const user = toUser(me, identity.id, identity.isOnboardingCompleted);
  const mapped = toProfile(fields, groups, user.id);
  return { user, groups: mapped.groups, fields: mapped.fields };
}

/* ── contacts ────────────────────────────────────────────────────────────────────────── */

/** `GET /contacts` + `GET /share-links`, joined into a per-contact count. */
export async function fetchContactsData() {
  const [me, identity, list] = await Promise.all([profile.me(), authMe(), contacts.list()]);
  const user = toUser(me, identity.id, identity.isOnboardingCompleted);
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
    const user = toUser(me, identity.id, identity.isOnboardingCompleted);

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

const sharing = await fetchCardSharing(cardId, dto.name, user.id);
    const card: ContactCard = toContactCard(dto, user.id);
    return { user, groups, fields, card, ...sharing };
  };
}

/**
 * Who a card was sent to and the registry to send it to next — the Share half of
 * `fetchCardDetail`, without the profile and card reads a screen that already holds them would
 * repeat. The Profile & Cards workspace's Share tab reads this for the selected card.
 *
 * Every part degrades rather than throws: a card must still be shareable when the recipients
 * list cannot be read.
 */
export async function fetchCardSharing(
  cardId: string,
  cardName: string,
  userId: string,
): Promise<{ shares: CardShareRow[]; contacts: Contact[]; currentVersion: number }> {
  let registry: Contact[] = [];
  try {
    const list = await contacts.list();
    registry = list.map((c) => toContact(c, userId));
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
    /**
     * The registry's name for a contact, else whatever the API called them, else the number —
     * formatted, the same rule the share dialog's picker uses. The raw E.164 fallback put
     * "+447979080009" in the recipients list directly under a picker showing
     * "+44 7979 080009" for the same person.
     */
    const labelFor = (contactId: string, displayName: string | null, phone: string): string => {
      const name = (byId.get(contactId)?.displayName ?? displayName)?.trim() ?? "";
      return name.length > 0 ? name : formatPhoneDisplay(phone);
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
        cardName,
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

  return { shares, contacts: registry, currentVersion };
}

/** `POST /auth/me`. Named so the four loaders that need the user id read the same way. */
function authMe() {
  return auth.me();
}

/* ── dashboard ───────────────────────────────────────────────────────────────────────── */

/**
 * Everything the dashboard reads — **one call, and every number computed by the API**.
 *
 * ## ⚠ What this replaced, and why it is one function call now
 *
 * This used to be `GET /profile/me` + `/auth/me` + `/profile/fields` + `/profile/groups` +
 * `GET /cards` + `GET /contacts` + `GET /share-links` + **one `GET /cards/{id}/audience` per
 * card** — an N+1 that grew with the owner's account, then reduced on the client into totals,
 * two charts and a queue.
 *
 * The request count was the smaller problem. The real one was arithmetic: `peopleReached` and
 * `behind` were reduced from two different collections, so a contact behind on two cards was
 * counted once in one aggregate and twice in the other, and `behind` could exceed
 * `peopleReached` — a state that cannot exist. `GET /dashboard` computes both from a single pass
 * over one ACTIVE-link query, which rules that out structurally rather than by matching two
 * client-side filters and hoping they stay matched.
 *
 * ## ⚠ Nothing here may be re-derived on the client
 *
 * The response is returned as it arrives. Recomputing any of it — re-sorting `attention`,
 * re-bucketing `sharingActivity`, re-summing `totals` — would reintroduce exactly the
 * two-sources-of-truth defect this endpoint exists to delete. `lib/dashboard/metrics.ts` is now
 * types and an adapter only, and `reach-score.ts` reads these totals rather than raw links.
 *
 * ## Why `GET /cards` is still here, and what it is emphatically NOT for
 *
 * ⚠ **It contributes no number to this screen.** `GET /dashboard` carries counts and names but
 * no appearance, and the charts colour every bar and every queue row by the palette its card
 * actually wears — that is how a reader matches a row to the card they know. So the card list is
 * read purely for `templateId`/`paletteId`/`groundHex`, mapped to palettes by `cardPalettes()`,
 * and nothing else on this screen may read it.
 *
 * The two run concurrently, so this is two rows in the Network tab rather than the four-plus-one-
 * per-card it replaced — and if the card read fails the screen still renders, because `palettes`
 * is optional on both charts and falls back to a neutral rule.
 */
export async function fetchDashboardData() {
  const [dto, cardDtos] = await Promise.all([
    dashboard.get(),
    /* Appearance only — and non-fatal. A failure here costs the bars their colour, not the
       dashboard its numbers, so it must not take the screen down with it. */
    cards.list().catch(() => []),
  ]);

  /* ⚠ Validated here, where the response enters the app, so the view and the score read the
     same checked totals. A deployed API older than this DTO omits newer counts — staging shipped
     without `peopleOpened` and the dial printed NaN — and those read `null` (unknown), never 0.
     See `readDashboardTotals`. */
  const rejected: string[] = [];
  const summary = readDashboardSummary(dto, rejected);
  if (rejected.length > 0) console.warn("[contactbook] dashboard.totals.unreadable", { rejected });

  return {
    summary,
    /* `toContactCard` needs a user id only to stamp `userId` on the domain object, which nothing
       on this screen reads — the palette is derived from the card's own design axes. A second
       `POST /auth/me` purely to fill a field no reader touches would be a request spent on
       nothing. */
    cards: cardDtos.map((dto) => toContactCard(dto, "")),
  };
}
