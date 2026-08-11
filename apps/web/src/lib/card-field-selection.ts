/**
 * Per-card share-field selection, persisted in the browser.
 *
 * The API has nowhere to keep the field types a card should share: `fieldTypes`
 * is only ever sent as a filter at `/vcard` and `/share` time and is never read
 * back, so the choice has to live client-side until the backend stores it.
 *
 * Every key is scoped by `userId` because a shared browser previously leaked one
 * account's state into the next signed-in account (`contactbook:google-connected`).
 * A signed-out user therefore reads nothing and writes nothing rather than
 * falling back to a browser-wide key.
 *
 * Note the inverted default this store carries: an empty array is a real value
 * meaning "share everything mapped to the card", which is why a stored `[]` must
 * survive a round-trip instead of collapsing into "never chosen".
 */
import {
  SHAREABLE_FIELD_TYPES,
  isShareableFieldType,
  type ShareableFieldType,
} from "@/lib/card-share-types";

export const CARD_FIELD_SELECTION_KEY_PREFIX = "contactbook:card-fields:v1";

/** The localStorage key holding every card selection for one user. */
export function cardFieldSelectionKey(userId: string): string {
  return `${CARD_FIELD_SELECTION_KEY_PREFIX}:${userId}`;
}

type CardFieldSelectionMap = Record<string, ShareableFieldType[]>;

/** Null whenever there is no user to scope to, so callers can bail in one check. */
function keyFor(userId: string | null): string | null {
  const trimmed = userId?.trim();
  return trimmed ? cardFieldSelectionKey(trimmed) : null;
}

// Safari private mode throws SecurityError on any storage access, and a full
// quota throws on write. A field preference is never worth crashing a page over.
function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Selection silently stays at its previous value.
  }
}

function removeRaw(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to fall back to; the key simply stays.
  }
}

/**
 * Canonical order, deduped, with anything the share API would reject removed —
 * a stored selection can outlive the deploy that dropped one of its types.
 */
function normalise(values: readonly unknown[]): ShareableFieldType[] {
  const wanted = new Set(
    values.filter(
      (value): value is ShareableFieldType =>
        typeof value === "string" && isShareableFieldType(value),
    ),
  );
  return SHAREABLE_FIELD_TYPES.filter((type) => wanted.has(type));
}

/** Every card selection stored for a user; `{}` when signed out or unreadable. */
export function readAllCardFieldSelections(
  userId: string | null,
): CardFieldSelectionMap {
  const key = keyFor(userId);
  if (!key) {
    return {};
  }
  const raw = readRaw(key);
  if (!raw) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  const selections: CardFieldSelectionMap = {};
  for (const [cardId, value] of Object.entries(parsed as Record<string, unknown>)) {
    // A malformed entry is dropped on its own; its neighbours stay usable.
    if (Array.isArray(value)) {
      selections[cardId] = normalise(value);
    }
  }
  return selections;
}

/**
 * The card's stored selection, or `[]` when it has none. Use
 * `readAllCardFieldSelections` when "never chosen" must be told apart from
 * "chose nothing".
 */
export function readCardFieldSelection(
  userId: string | null,
  cardId: string,
): ShareableFieldType[] {
  return readAllCardFieldSelections(userId)[cardId] ?? [];
}

export function writeCardFieldSelection(
  userId: string | null,
  cardId: string,
  types: ShareableFieldType[],
): void {
  const key = keyFor(userId);
  if (!key || !cardId.trim()) {
    return;
  }
  const next: CardFieldSelectionMap = {
    ...readAllCardFieldSelections(userId),
    [cardId]: normalise(types),
  };
  writeRaw(key, JSON.stringify(next));
}

/** Forgets one card — call after deleting it so the map cannot grow forever. */
export function dropCardFieldSelection(
  userId: string | null,
  cardId: string,
): void {
  const key = keyFor(userId);
  if (!key) {
    return;
  }
  const selections = readAllCardFieldSelections(userId);
  if (!(cardId in selections)) {
    return;
  }
  delete selections[cardId];

  if (Object.keys(selections).length === 0) {
    removeRaw(key);
    return;
  }
  writeRaw(key, JSON.stringify(selections));
}

/**
 * Wipes every user's selections. Wired into logout: the signing-out user's id is
 * not always still available there, and leaving another account's key behind is
 * the leak this store exists to prevent.
 */
export function clearAllCardFieldSelections(): void {
  const prefix = `${CARD_FIELD_SELECTION_KEY_PREFIX}:`;
  const keys: string[] = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) {
        keys.push(key);
      }
    }
  } catch {
    return;
  }
  // Collected first: removing during the walk shifts the remaining indices.
  for (const key of keys) {
    removeRaw(key);
  }
}
