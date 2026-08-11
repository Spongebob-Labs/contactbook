/**
 * First-visit guided tour of the card page — the pure half.
 *
 * Holds the step copy and the per-user "already seen" flag. Nothing here
 * touches the DOM or driver.js; the binding lives in `@/lib/use-card-tour`,
 * which keeps the copy and the flag testable without a browser.
 *
 * The flag is user-scoped for the same reason the field selection store is:
 * on a shared browser one account's state must never decide what the next
 * account sees.
 */

export const CARD_TOUR_SEEN_KEY_PREFIX = "contactbook:card-tour-seen:v1";

const SEEN_VALUE = "1";

export type TourStep = {
  /** CSS selector for a `data-tour` hook the card page renders. */
  element: string;
  title: string;
  description: string;
};

/**
 * The four stops of the tour, in walking order. Frozen because driver.js is
 * handed this array directly and a consumer mutating it would change the tour
 * for every later visit in the same session.
 */
export const CARD_TOUR_STEPS: readonly TourStep[] = Object.freeze([
  Object.freeze({
    element: '[data-tour="card-share"]',
    title: "Send this card",
    description:
      "Tap here to send this card on WhatsApp. Whoever gets it can save you in one tap.",
  }),
  Object.freeze({
    element: '[data-tour="card-tabs"]',
    title: "Switch between views",
    description:
      "Move between this card's settings, what it shares, and everyone you have sent it to.",
  }),
  Object.freeze({
    element: '[data-tour="card-shared-fields"]',
    title: "Choose what you share",
    description:
      "Tick only the details you want to hand out. Untick anything you would rather keep private.",
  }),
  Object.freeze({
    element: '[data-tour="card-vcard-preview"]',
    title: "Preview the contact file",
    description:
      "See the contact file before you send it. This is how you land in their phonebook.",
  }),
]);

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** The storage key for a user, or null when there is no user to scope by. */
function seenKey(userId: string | null): string | null {
  const id = userId?.trim() ?? "";
  return id.length > 0 ? `${CARD_TOUR_SEEN_KEY_PREFIX}:${id}` : null;
}

/**
 * Whether this user has already been shown the card tour.
 *
 * Returns true whenever we cannot read a per-user flag — no user id, or a
 * blocked store. A tour whose dismissal we cannot remember would reopen on
 * every render, which is far worse than never showing it.
 */
export function hasSeenCardTour(userId: string | null): boolean {
  const key = seenKey(userId);
  if (!key || !canUseLocalStorage()) {
    return true;
  }
  try {
    // Any stored value counts: we only ever write "1", so a stray value still
    // means the tour was marked and must not replay.
    return (localStorage.getItem(key) ?? "").length > 0;
  } catch {
    return true;
  }
}

/** Records that the tour ran. A no-op without a user id — see `hasSeenCardTour`. */
export function markCardTourSeen(userId: string | null): void {
  const key = seenKey(userId);
  if (!key || !canUseLocalStorage()) {
    return;
  }
  try {
    localStorage.setItem(key, SEEN_VALUE);
  } catch {
    // Nothing to recover: the tour simply shows again next visit.
  }
}

/** Drops every user's flag. Called on logout so accounts never share state. */
export function clearAllCardTourSeen(): void {
  if (!canUseLocalStorage()) {
    return;
  }
  try {
    const doomed: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(CARD_TOUR_SEEN_KEY_PREFIX)) {
        doomed.push(key);
      }
    }
    // Collected before removing: deleting mid-walk shifts the later indices.
    for (const key of doomed) {
      localStorage.removeItem(key);
    }
  } catch {
    // A blocked store has nothing to clear.
  }
}
