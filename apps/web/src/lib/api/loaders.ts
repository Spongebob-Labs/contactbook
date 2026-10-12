import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { auth, cards, contacts, profile, shareLinks } from "@/lib/api";
import { ONBOARDING_DONE_COOKIE } from "@/lib/api/config";
import { isApiError } from "@/lib/api/errors";
import {
  groupSharesByContact,
  toContact,
  toContactCard,
  toProfile,
  toUser,
  type MappedProfile,
} from "@/lib/api/map";
import type { ShareLinkResponseDto } from "@/lib/api/schema";
import type { Contact, ContactCard, ContactShare, User } from "@/types/domain";

/**
 * Request-scoped reads, deduplicated.
 *
 * ## Why `cache()` and not a fetch cache
 * Every call in this client is `cache: "no-store"` — a profile that shows yesterday's fields is
 * worse than a slow one. But "never cache across requests" is not the same as "fetch twice
 * within one render", and that is exactly what was about to happen: `(app)/layout.tsx` needs the
 * user for the sidebar chip, and `/profile` needs the same `GET /profile/me` for the identity
 * block. Two components, one request, one round trip.
 *
 * React's `cache()` memoises for the lifetime of a single server request and forgets afterwards,
 * which is precisely the scope wanted. It is not a cache in the HTTP sense and adds no staleness.
 *
 * ⚠ Only wrap **reads**. A memoised mutation would silently swallow the second call.
 */

/** The signed-in user. Shared by the app layout and every screen that names them. */
export const loadUser = cache(async (): Promise<User> => {
  // Concurrent because they are independent: `GET /profile/me` carries the profile but no user
  // id, and `POST /auth/me` carries the id and nothing else.
  const [me, identity] = await Promise.all([profile.profileMe(), auth.authMe()]);
  return toUser(me, identity.id, identity.isOnboardingCompleted);
});

/**
 * Whether first-time setup is finished — what the `(app)` onboarding gate turns on.
 *
 * **Fast path**: checks `cb_ob` first. The BFF proxy sets this cookie the moment
 * `POST /profile/onboarding` returns 200 (or 409), bypassing the DB entirely. This exists
 * because Supabase Supavisor (transaction-mode pooler) can briefly serve a stale snapshot from
 * a different pool connection in the seconds after the onboarding transaction commits, causing
 * the gate to redirect a freshly-onboarded user back to `/signup/first-name`.
 *
 * Falls back to `loadUser()` for all other navigations (returning users, page refreshes, etc.)
 * where the cookie may not be present.
 */
export const loadOnboardingCompleted = cache(async (): Promise<boolean> => {
  const jar = await cookies();
  if (jar.get(ONBOARDING_DONE_COOKIE)?.value === "1") return true;
  const user = await loadUser();
  return user.onboardingCompleted;
});

/**
 * The whole profile, in domain shape.
 *
 * Reads the **flat field list and the group list**, not `GET /profile/me`, because
 * `MeResponseDto`'s buckets have no home for `CUSTOM` and fold `IDENTITY` into a flat object —
 * so a profile assembled from it can omit fields that exist. See `toProfile`.
 */
export const loadProfile = cache(async (): Promise<{ user: User; profile: MappedProfile }> => {
  const [user, fields, groups] = await Promise.all([
    loadUser(),
    profile.listFields(),
    profile.listGroups(),
  ]);
  return { user, profile: toProfile(fields, groups, user.id) };
});

/**
 * The contact registry, plus how many cards each contact has been sent.
 *
 * `GET /share-links` returns one flat list across every card, so the per-contact count has to be
 * computed here. A count rather than the links themselves, because the list screen renders one
 * integer per row and shipping every link for every row would be a large payload to display it.
 *
 * A share-links failure degrades to zero counts rather than failing the screen: losing the
 * "cards sent" column is a smaller loss than losing the registry.
 */
export const loadContacts = cache(
  async (): Promise<{ contacts: Contact[]; shareCounts: Record<string, number> }> => {
    const [user, list] = await Promise.all([loadUser(), contacts.listContacts()]);
    const mapped = list.map((dto) => toContact(dto, user.id));

    let shareCounts: Record<string, number> = {};
    try {
      const links = await shareLinks.listShareLinks();
      shareCounts = Object.fromEntries(
        [...groupSharesByContact(links)].map(([contactId, shares]) => [contactId, shares.length]),
      );
    } catch {
      shareCounts = {};
    }

    return { contacts: mapped, shareCounts };
  },
);

/**
 * One contact and every card sent to them.
 *
 * Reads the contact by id rather than filtering `loadContacts`, so a contact belonging to somebody
 * else 404s at the API instead of quietly not being found in a list — the difference between an
 * authorisation boundary and a client-side filter.
 */
export const loadContact = cache(
  async (contactId: string): Promise<{ contact: Contact; shares: ContactShare[] } | null> => {
    const user = await loadUser();

    let dto: Awaited<ReturnType<typeof contacts.getContact>>;
    try {
      dto = await contacts.getContact(contactId);
    } catch (thrown) {
      // A missing contact is a not-found *screen*, not a failed read — so it is `null` here and
      // every other failure keeps throwing for the caller to surface as an error panel.
      if (isApiError(thrown) && thrown.code === "CONTACT_NOT_FOUND") return null;
      throw thrown;
    }

    let shares: ContactShare[] = [];
    try {
      const links = await shareLinks.listShareLinks();
      shares = groupSharesByContact(links).get(contactId) ?? [];
    } catch {
      shares = [];
    }

    return { contact: toContact(dto, user.id), shares };
  },
);

/**
 * Every card, plus the profile they filter.
 *
 * Both, because a card owns no data (§5.3): `resolveCard` needs the owner's groups and fields to
 * turn a list of field ids into rendered rows. Fetching them separately per card would be one
 * profile read per tile.
 */
export const loadCards = cache(
  async (): Promise<{ user: User; profile: MappedProfile; cards: ContactCard[] }> => {
    const [{ user, profile: mapped }, list] = await Promise.all([
      loadProfile(),
      cards.listCards(),
    ]);
    return { user, profile: mapped, cards: list.map((dto) => toContactCard(dto, user.id)) };
  },
);

/**
 * One card, the profile it filters, and every link minted for it.
 *
 * Reads the card by id rather than filtering `loadCards`, so another owner's card id 404s at the
 * API instead of quietly not being found in a list — an authorisation boundary, not a filter.
 *
 * Returns `null` for a card that does not exist, so the caller can send it to `not-found.tsx`
 * while every other failure keeps throwing to become an error panel.
 */
export const loadCard = cache(
  async (
    cardId: string,
  ): Promise<{
    user: User;
    profile: MappedProfile;
    card: ContactCard;
    shares: ShareLinkResponseDto[];
  } | null> => {
    const { user, profile: mapped } = await loadProfile();

    let dto: Awaited<ReturnType<typeof cards.getCard>>;
    try {
      dto = await cards.getCard(cardId);
    } catch (thrown) {
      if (isApiError(thrown) && thrown.code === "CARD_NOT_FOUND") return null;
      throw thrown;
    }

    // Degrades to no links rather than failing the screen: losing the send history is a smaller
    // loss than losing the card.
    let shares: ShareLinkResponseDto[] = [];
    try {
      const links = await shareLinks.listShareLinks();
      shares = links.filter((link) => link.cardId === cardId);
    } catch {
      shares = [];
    }

    return { user, profile: mapped, card: toContactCard(dto, user.id), shares };
  },
);

/** The contact registry, for the share picker. Reuses `loadContacts`'s memoised read. */
export const loadContactsForShare = cache(async (): Promise<Contact[]> => {
  const { contacts: list } = await loadContacts();
  return list;
});
