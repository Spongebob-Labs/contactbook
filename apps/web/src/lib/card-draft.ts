import type { CardSnapshot } from "@/lib/card-schema";

/**
 * Local draft storage for the card builder.
 *
 * Drafts live in the browser, never on the server: the editor and preview read
 * from here so typing is instant, and only an explicit Publish sends anything
 * to the API. That separation is the point — a card's public URL can be sitting
 * in a stranger's Wallet while its owner is mid-edit, and a half-typed phone
 * number must never appear there.
 *
 * The cost is that drafts do not follow you across devices. Accepted
 * deliberately; moving them server-side is a second JSON column when it matters.
 */

const DRAFT_KEY = "contactbook:card-draft:v1";

export type CardDraft = {
  snapshot: CardSnapshot;
  /**
   * Fingerprint of the snapshot as last published, or null if this card has
   * never been published. Storing a hash rather than a second copy keeps
   * photo-carrying drafts from doubling in size.
   */
  publishedFingerprint: string | null;
  updatedAt: string;
};

type DraftStore = Record<string, CardDraft>;

/**
 * JSON with keys sorted at every level.
 *
 * Plain `JSON.stringify` follows insertion order, so two snapshots that are
 * value-identical but built by different code paths would fingerprint
 * differently and show a phantom "unpublished changes" badge.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`);

  return `{${entries.join(",")}}`;
}

/** FNV-1a over the canonical form — short, stable, and not security-bearing. */
export function snapshotFingerprint(snapshot: CardSnapshot): string {
  const input = canonicalJson(snapshot);
  let hash = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function readStore(): DraftStore {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as DraftStore;
  } catch {
    return {};
  }
}

function writeStore(store: DraftStore): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    return true;
  } catch {
    // Almost always a quota error from an oversized inline photo. The caller
    // surfaces this rather than letting the draft silently fail to persist.
    return false;
  }
}

export function readCardDraft(cardId: string): CardDraft | null {
  return readStore()[cardId] ?? null;
}

/** Persist edits. Returns false when storage rejected the write. */
export function writeCardDraft(
  cardId: string,
  snapshot: CardSnapshot,
): boolean {
  const store = readStore();
  store[cardId] = {
    snapshot,
    publishedFingerprint: store[cardId]?.publishedFingerprint ?? null,
    updatedAt: new Date().toISOString(),
  };
  return writeStore(store);
}

/** Record what was just published so the dirty indicator settles. */
export function markCardPublished(
  cardId: string,
  snapshot: CardSnapshot,
): void {
  const store = readStore();
  store[cardId] = {
    snapshot,
    publishedFingerprint: snapshotFingerprint(snapshot),
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
}

/** After unpublishing, everything in the draft counts as unpublished again. */
export function markCardUnpublished(cardId: string): void {
  const store = readStore();
  const existing = store[cardId];
  if (!existing) {
    return;
  }
  store[cardId] = { ...existing, publishedFingerprint: null };
  writeStore(store);
}

export function removeCardDraft(cardId: string): void {
  const store = readStore();
  delete store[cardId];
  writeStore(store);
}

export function hasUnpublishedChanges(draft: CardDraft | null): boolean {
  if (!draft) {
    return false;
  }
  if (draft.publishedFingerprint === null) {
    return true;
  }
  return snapshotFingerprint(draft.snapshot) !== draft.publishedFingerprint;
}
