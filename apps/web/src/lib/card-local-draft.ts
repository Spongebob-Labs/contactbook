import type { ContactCard } from "@/types/domain";

/**
 * ⚠ **A TEMPORARY CLIENT-SIDE STORE FOR THE THREE SLOTS THE API CANNOT HOLD YET.**
 *
 * ## Why this exists
 *
 * `ContactCard.coverUrl`, `.headline` and `.bio` are rendered by the card and written by the
 * builder, and **no column exists for any of them** — see the ⚠ block on `ContactCard` for the
 * exact schema the backend has to add. Until it does, Save sends them nowhere and a reload
 * loses them: an owner sets a cover, a position and a bio, presses Save, comes back, and the
 * card is a name and a list of fields again.
 *
 * That is not an acceptable state to demonstrate the design in, and the standing instruction is
 * to build the maximum on the front end and hand the backend a list. So the three live in
 * `localStorage`, keyed by card id, and are merged back onto the card wherever it is resolved
 * on the client.
 *
 * ## ⚠ What this is NOT
 *
 * It is not persistence. It is per-browser, per-device and per-origin: the owner's own phone
 * will not show what they set on their laptop, and `/c/{slug}` — which is server-rendered — will
 * not show it at all, because the server has no access to this. Anyone reading this file while
 * wondering why a shared card looks plainer than the builder's preview has found the reason.
 *
 * **Delete this module the day the three columns land.** Its whole surface is two functions, and
 * the call sites are marked.
 *
 * ## Why the cover is stored as a data URL and not an object URL
 *
 * `URL.createObjectURL` mints a handle that dies with the document, so persisting one would
 * store a string that is already broken on the next load. The cover is therefore downscaled and
 * encoded (`image-to-data-url.ts`) before it reaches here — which also keeps it inside the ~5MB
 * `localStorage` budget that a raw phone photograph would blow on its own.
 */

/** The three UI-only slots, as stored. */
export interface LocalCardDraft {
  coverUrl?: string | null;
  headline?: string | null;
  bio?: string | null;
}

const PREFIX = "cb:card-draft:";

/**
 * ⚠ Every read and write is wrapped, and the failure is silent by design.
 *
 * `localStorage` throws rather than returning undefined in a private window, with site data
 * blocked, and when the origin's quota is exceeded — and the last one is reachable here, because
 * a cover is a base64 image. A card that renders without its cover is a degraded card; a card
 * that throws on render is a broken screen. This module always chooses the first.
 */
function read(cardId: string): LocalCardDraft {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PREFIX + cardId);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    /* Shape-checked rather than cast: this string is user-writable — devtools, a stale build, a
       browser extension — and `resolveCard` would happily put a number where a URL goes. */
    if (parsed === null || typeof parsed !== "object") return {};
    const draft = parsed as Record<string, unknown>;
    const str = (key: string): string | undefined =>
      typeof draft[key] === "string" ? (draft[key] as string) : undefined;
    return { coverUrl: str("coverUrl"), headline: str("headline"), bio: str("bio") };
  } catch {
    return {};
  }
}

/**
 * Store the three slots for one card. A slot set to `null` or `""` is removed rather than
 * stored empty, so "the owner cleared it" and "the owner never set it" are one state — which is
 * what every reader already treats them as.
 */
export function saveLocalCardDraft(cardId: string, draft: LocalCardDraft): void {
  if (typeof window === "undefined") return;
  const next: LocalCardDraft = {};
  if (typeof draft.coverUrl === "string" && draft.coverUrl.trim() !== "") {
    next.coverUrl = draft.coverUrl;
  }
  if (typeof draft.headline === "string" && draft.headline.trim() !== "") {
    next.headline = draft.headline.trim();
  }
  if (typeof draft.bio === "string" && draft.bio.trim() !== "") next.bio = draft.bio.trim();

  try {
    if (Object.keys(next).length === 0) window.localStorage.removeItem(PREFIX + cardId);
    else window.localStorage.setItem(PREFIX + cardId, JSON.stringify(next));
  } catch {
    /* Quota, private mode, blocked storage. The card renders without them — see the ⚠ above. */
  }
}

/**
 * The card with its locally-held slots merged on, for any surface that resolves on the client.
 *
 * ⚠ **The card's OWN value wins.** The merge only fills what the wire did not carry, so the day
 * the API starts sending `coverUrl` the server becomes the source of truth automatically and
 * this module stops having an effect — rather than a stale local copy silently overriding a real
 * one for everybody who ever used the builder on that browser.
 */
export function withLocalCardDraft(card: ContactCard): ContactCard {
  const draft = read(card.id);
  if (draft.coverUrl === undefined && draft.headline === undefined && draft.bio === undefined) {
    /* The same object, so a consumer memoising on identity is not defeated by this call. */
    return card;
  }
  return {
    ...card,
    coverUrl: card.coverUrl ?? draft.coverUrl ?? null,
    headline: card.headline ?? draft.headline ?? null,
    bio: card.bio ?? draft.bio ?? null,
  };
}
