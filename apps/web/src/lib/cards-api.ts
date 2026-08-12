/**
 * Contact card CRUD and field mappings.
 *
 * A card is server state only — `{ name, type, isSensitive }` plus the profile
 * fields mapped onto it. Sharing lives in `@/lib/card-share-api`.
 */
import { apiFetch } from "@/lib/api";
import type { ContactCard, ContactCardType } from "@/lib/types";

export type ApiContactCard = {
  id: string;
  userId?: string;
  name: string;
  type: string;
  isSensitive?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CardFieldMapping = {
  cardId: string;
  fieldId: string;
};

/** Live API card types only. Unknown/legacy values (e.g. PAYMENT) → CUSTOM. */
export function toApiCardType(
  type: string,
): "PERSONAL" | "BUSINESS" | "CUSTOM" {
  if (type === "PERSONAL" || type === "BUSINESS" || type === "CUSTOM") {
    return type;
  }
  return "CUSTOM";
}

function assertServerCard(card: ApiContactCard, action: string): ApiContactCard {
  if (!card?.id || typeof card.id !== "string") {
    throw new Error(`Card ${action} did not return a server id.`);
  }
  return card;
}

function toContactCard(
  apiCard: ApiContactCard,
  mappedFieldIds?: string[],
): ContactCard {
  return {
    id: apiCard.id,
    userId: apiCard.userId ?? "",
    name: apiCard.name,
    type: toApiCardType(apiCard.type),
    isSensitive: apiCard.isSensitive ?? false,
    createdAt: apiCard.createdAt,
    updatedAt: apiCard.updatedAt,
    ...(mappedFieldIds ? { mappedFieldIds } : {}),
  };
}

export async function listCards(): Promise<ContactCard[]> {
  const cards = await apiFetch<ApiContactCard[]>("/v1/cards");
  return cards
    .map((card) => toContactCard(card))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

/**
 * Cards plus the ids of the profile fields attached to each.
 *
 * `listCards` deliberately skips this — it is one request per card. But any
 * screen that offers a card as a source of details needs it: a card with no
 * attached fields produces a name-only contact file, and without the count
 * there is no way to tell that card apart from a complete one.
 *
 * A failed lookup leaves `mappedFieldIds` undefined — "unknown", never "empty",
 * so a transient error cannot make a full card look barren.
 */
export async function listCardsWithFieldCounts(): Promise<ContactCard[]> {
  const cards = await listCards();
  return Promise.all(
    cards.map(async (card) => {
      const mappings = await listCardFieldMappings(card.id).catch(() => null);
      return mappings
        ? { ...card, mappedFieldIds: mappings.map((item) => item.fieldId) }
        : card;
    }),
  );
}

export async function getCard(cardId: string): Promise<ContactCard> {
  const card = await apiFetch<ApiContactCard>(`/v1/cards/${cardId}`);
  // Mappings are a separate call and are non-critical for rendering the card.
  const mappings = await listCardFieldMappings(cardId).catch(
    () => [] as CardFieldMapping[],
  );
  return toContactCard(
    card,
    mappings.map((item) => item.fieldId),
  );
}

export async function createCard(input: {
  name: string;
  type: ContactCardType;
}): Promise<ContactCard> {
  const created = assertServerCard(
    await apiFetch<ApiContactCard>("/v1/cards", {
      method: "POST",
      body: {
        name: input.name.trim(),
        type: toApiCardType(input.type),
      },
    }),
    "create",
  );
  return toContactCard(created);
}

export async function updateCard(
  cardId: string,
  input: {
    name?: string;
    type?: ContactCardType;
    isSensitive?: boolean;
  },
): Promise<ContactCard> {
  const patched = assertServerCard(
    await apiFetch<ApiContactCard>(`/v1/cards/${cardId}`, {
      method: "PATCH",
      body: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.type !== undefined ? { type: toApiCardType(input.type) } : {}),
        ...(input.isSensitive !== undefined
          ? { isSensitive: input.isSensitive }
          : {}),
      },
    }),
    "update",
  );
  return toContactCard(patched);
}

export async function deleteCard(cardId: string): Promise<void> {
  await apiFetch<{ ok: true }>(`/v1/cards/${cardId}`, {
    method: "DELETE",
  });
}

/**
 * Profile fields mapped to a card. The API returns ids only — no type, label,
 * or value — so these are counted in the UI, never listed.
 */
export async function listCardFieldMappings(
  cardId: string,
): Promise<CardFieldMapping[]> {
  return apiFetch<CardFieldMapping[]>(`/v1/cards/${cardId}/field-mappings`);
}

export async function addCardFieldMapping(
  cardId: string,
  fieldId: string,
): Promise<CardFieldMapping> {
  return apiFetch<CardFieldMapping>(`/v1/cards/${cardId}/field-mappings`, {
    method: "POST",
    body: { fieldId },
  });
}

/**
 * Copies every profile field mapped to `fromCardId` onto `toCardId`.
 *
 * This is the only way to give a card created by `POST /cards` any content: the
 * server maps fields to cards once, during profile onboarding, and never again.
 * The API accepts any field the caller owns, so copying between the user's own
 * cards is allowed. Already-present mappings return 400 and are skipped.
 *
 * Returns how many were added, so the UI can report honestly.
 */
export async function copyCardFieldMappings(
  fromCardId: string,
  toCardId: string,
): Promise<{ copied: number; total: number }> {
  const [source, existing] = await Promise.all([
    listCardFieldMappings(fromCardId),
    listCardFieldMappings(toCardId).catch(() => [] as CardFieldMapping[]),
  ]);
  const alreadyMapped = new Set(existing.map((item) => item.fieldId));
  const pending = source.filter((item) => !alreadyMapped.has(item.fieldId));

  let copied = 0;
  for (const mapping of pending) {
    try {
      await addCardFieldMapping(toCardId, mapping.fieldId);
      copied += 1;
    } catch {
      // Duplicate or since-deleted field — skip it and keep going.
    }
  }
  return { copied, total: source.length };
}

export async function removeCardFieldMapping(
  cardId: string,
  fieldId: string,
): Promise<void> {
  await apiFetch<{ ok: true }>(
    `/v1/cards/${cardId}/field-mappings/${fieldId}`,
    { method: "DELETE" },
  );
}
