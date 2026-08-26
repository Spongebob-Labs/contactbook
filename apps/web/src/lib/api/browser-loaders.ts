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
import { isApiError } from "@/lib/api/errors";
import {
  groupSharesByContact,
  toContact,
  toContactCard,
  toContactShare,
  toProfile,
  toUser,
} from "@/lib/api/map";
import { contactLabel, type Contact, type ContactCard, type ContactShare } from "@/types/domain";

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

    let shares: Array<ContactShare & { contactId: string; contactLabel: string }> = [];
    try {
      const byId = new Map(registry.map((c) => [c.id, c]));
      shares = (await shareLinks.list())
        .filter((link) => link.cardId === cardId)
        .map((link) => {
          const contact = byId.get(link.contactId);
          return {
            ...toContactShare(link),
            contactId: link.contactId,
            contactLabel:
              contact !== undefined
                ? contactLabel(contact)
                : (link.contactDisplayName ?? link.contactPhoneE164),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      shares = [];
    }

    const card: ContactCard = toContactCard(dto, user.id);
    return { user, groups, fields, card, shares, contacts: registry };
  };
}

/** `POST /auth/me`. Named so the four loaders that need the user id read the same way. */
function authMe() {
  return auth.me();
}
