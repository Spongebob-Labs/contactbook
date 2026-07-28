import type {
  ContactCardFields,
  ContactCardTemplate,
  ContactCardTheme,
} from "@/lib/types";

/** Client-only card presentation keyed by server card id (theme/template/fields). */
export type CardPresentation = {
  fields?: ContactCardFields;
  theme?: ContactCardTheme;
  template?: ContactCardTemplate;
  mappedFieldIds?: string[];
};

const PRESENTATION_KEY = "contactbook:card-presentation";

type PresentationStore = Record<string, CardPresentation>;

function readStore(): PresentationStore {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(PRESENTATION_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as PresentationStore;
  } catch {
    return {};
  }
}

function writeStore(store: PresentationStore) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(PRESENTATION_KEY, JSON.stringify(store));
}

export function getCardPresentation(cardId: string): CardPresentation | null {
  return readStore()[cardId] ?? null;
}

export function setCardPresentation(
  cardId: string,
  presentation: CardPresentation,
) {
  const store = readStore();
  store[cardId] = {
    ...store[cardId],
    ...presentation,
  };
  writeStore(store);
}

export function removeCardPresentation(cardId: string) {
  const store = readStore();
  delete store[cardId];
  writeStore(store);
}
