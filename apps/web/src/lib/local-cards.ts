import { mockCards } from "@/lib/mock-data";
import type {
  ContactCard,
  ContactCardFields,
  ContactCardTemplate,
  ContactCardTheme,
  ContactCardType,
} from "@/lib/types";

/**
 * Frontend-only card store for UI design work.
 * Flip USE_LOCAL_CARDS to false when the real cards API is ready to integrate.
 */
export const USE_LOCAL_CARDS = true;

const LOCAL_CARDS_KEY = "contactbook:local-cards";

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `local-card-${crypto.randomUUID()}`;
  }
  return `local-card-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readStore(): ContactCard[] {
  if (typeof window === "undefined") {
    return [...mockCards];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_CARDS_KEY);
    if (!raw) {
      const seeded = [...mockCards];
      window.localStorage.setItem(LOCAL_CARDS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [...mockCards];
    }
    return parsed as ContactCard[];
  } catch {
    return [...mockCards];
  }
}

function writeStore(cards: ContactCard[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LOCAL_CARDS_KEY, JSON.stringify(cards));
}

export function listLocalCards(): ContactCard[] {
  return readStore().slice().sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function getLocalCard(cardId: string | undefined): ContactCard | null {
  if (!cardId) {
    return null;
  }
  return readStore().find((card) => card.id === cardId) ?? null;
}

export function createLocalCard(input: {
  name: string;
  type: ContactCardType;
  fields?: ContactCardFields;
  theme?: ContactCardTheme;
  template?: ContactCardTemplate;
}): ContactCard {
  const stamp = nowIso();
  const card: ContactCard = {
    id: createId(),
    userId: "local-user",
    name: input.name.trim(),
    type: input.type,
    createdAt: stamp,
    updatedAt: stamp,
    ...(input.fields ? { fields: input.fields } : {}),
    ...(input.theme ? { theme: input.theme } : {}),
    ...(input.template ? { template: input.template } : {}),
  };
  const next = [card, ...readStore().filter((item) => item.id !== card.id)];
  writeStore(next);
  return card;
}

export function upsertLocalCard(card: ContactCard): ContactCard {
  const next = [
    card,
    ...readStore().filter((item) => item.id !== card.id),
  ];
  writeStore(next);
  return card;
}
