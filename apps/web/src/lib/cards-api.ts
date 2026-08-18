import { apiFetch } from "@/lib/api";
import {
  getCardPresentation,
  removeCardPresentation,
  setCardPresentation,
  type CardPresentation,
} from "@/lib/card-presentation";
import type { CardSnapshot } from "@/lib/card-schema";
import type {
  ContactCard,
  ContactCardFields,
  ContactCardTemplate,
  ContactCardTheme,
  ContactCardType,
} from "@/lib/types";

export type ApiContactCard = {
  id: string;
  userId?: string;
  name: string;
  type: string;
  isSensitive?: boolean;
  createdAt: string;
  updatedAt: string;
  slug?: string | null;
  publishedAt?: string | null;
  /** Detail endpoint only; the list endpoint omits it. */
  publishedSnapshot?: unknown;
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

function mergeCard(
  apiCard: ApiContactCard,
  presentation?: CardPresentation | null,
): ContactCard {
  const local = presentation ?? getCardPresentation(apiCard.id);
  return {
    id: apiCard.id,
    userId: apiCard.userId ?? "",
    name: apiCard.name,
    type: toApiCardType(apiCard.type),
    createdAt: apiCard.createdAt,
    updatedAt: apiCard.updatedAt,
    ...(apiCard.isSensitive !== undefined
      ? { isSensitive: apiCard.isSensitive }
      : {}),
    slug: apiCard.slug ?? null,
    publishedAt: apiCard.publishedAt ?? null,
    ...(apiCard.publishedSnapshot !== undefined
      ? { publishedSnapshot: apiCard.publishedSnapshot }
      : {}),
    ...(local?.fields ? { fields: local.fields } : {}),
    ...(local?.theme ? { theme: local.theme } : {}),
    ...(local?.template ? { template: local.template } : {}),
    ...(local?.mappedFieldIds ? { mappedFieldIds: local.mappedFieldIds } : {}),
  };
}

export async function listCards(): Promise<ContactCard[]> {
  const cards = await apiFetch<ApiContactCard[]>("/v1/cards");
  return cards
    .map((card) => mergeCard(card))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

export async function getCard(cardId: string): Promise<ContactCard> {
  const card = await apiFetch<ApiContactCard>(`/v1/cards/${cardId}`);
  const mappings = await listCardFieldMappings(cardId).catch(() => [] as CardFieldMapping[]);
  const presentation = getCardPresentation(cardId);
  return mergeCard(card, {
    ...presentation,
    mappedFieldIds: mappings.map((item) => item.fieldId),
  });
}

export async function createCard(input: {
  name: string;
  type: ContactCardType;
  fields?: ContactCardFields;
  theme?: ContactCardTheme;
  template?: ContactCardTemplate;
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
  // Theme/template/preview fields are client presentation only (no API).
  // The shareable card on the server is name + type + field-mappings.
  setCardPresentation(created.id, {
    fields: input.fields,
    theme: input.theme,
    template: input.template,
  });
  return mergeCard(created);
}

export async function updateCard(
  cardId: string,
  input: {
    name?: string;
    type?: ContactCardType;
    isSensitive?: boolean;
    fields?: ContactCardFields;
    theme?: ContactCardTheme;
    template?: ContactCardTemplate;
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
  const existing = getCardPresentation(cardId);
  setCardPresentation(cardId, {
    fields: input.fields ?? existing?.fields,
    theme: input.theme ?? existing?.theme,
    template: input.template ?? existing?.template,
    mappedFieldIds: existing?.mappedFieldIds,
  });
  return mergeCard(patched);
}

export async function deleteCard(cardId: string): Promise<void> {
  await apiFetch<{ ok: true }>(`/v1/cards/${cardId}`, {
    method: "DELETE",
  });
  removeCardPresentation(cardId);
}

export async function listCardFieldMappings(
  cardId: string,
): Promise<CardFieldMapping[]> {
  return apiFetch<CardFieldMapping[]>(`/v1/cards/${cardId}/field-mappings`);
}

export async function addCardFieldMapping(
  cardId: string,
  fieldId: string,
): Promise<CardFieldMapping> {
  const mapping = await apiFetch<CardFieldMapping>(
    `/v1/cards/${cardId}/field-mappings`,
    {
      method: "POST",
      body: { fieldId },
    },
  );
  const existing = getCardPresentation(cardId) ?? {};
  const mappedFieldIds = Array.from(
    new Set([...(existing.mappedFieldIds ?? []), fieldId]),
  );
  setCardPresentation(cardId, { ...existing, mappedFieldIds });
  return mapping;
}

export async function removeCardFieldMapping(
  cardId: string,
  fieldId: string,
): Promise<void> {
  await apiFetch<{ ok: true }>(
    `/v1/cards/${cardId}/field-mappings/${fieldId}`,
    { method: "DELETE" },
  );
  const existing = getCardPresentation(cardId);
  if (!existing) {
    return;
  }
  setCardPresentation(cardId, {
    ...existing,
    mappedFieldIds: (existing.mappedFieldIds ?? []).filter((id) => id !== fieldId),
  });
}

/** Server-generated VCF asset for a card (`POST /cards/:cardId/vcard`). */
export type CardVcardAsset = {
  url: string;
  key: string;
  mimeType: string;
  contentHash: string;
};

export async function generateCardVcard(
  cardId: string,
  fieldTypes?: string[],
): Promise<CardVcardAsset> {
  return apiFetch<CardVcardAsset>(`/v1/cards/${cardId}/vcard`, {
    method: "POST",
    body: fieldTypes?.length ? { fieldTypes } : {},
  });
}

/** A card plus its publish state. `slug` is null until the first publish. */
export type ApiPublishedCard = ApiContactCard & {
  slug: string | null;
  publishedAt: string | null;
};

/** What `GET /v1/public/cards/:slug` returns — snapshot only, no owner data. */
export type PublicCardResponse = {
  slug: string;
  /** Unvalidated on the wire; run it through `parseCardSnapshot` before use. */
  snapshot: unknown;
  publishedAt: string | null;
};

/**
 * Publish or re-publish. Idempotent: the slug is minted once and then reused,
 * so a card's public URL never moves once it has been shared.
 */
export async function publishCard(
  cardId: string,
  snapshot: CardSnapshot,
): Promise<ApiPublishedCard> {
  return apiFetch<ApiPublishedCard>(`/v1/cards/${cardId}/publish`, {
    method: "PUT",
    body: { snapshot },
  });
}

/** Take the card offline. The slug stays reserved for a later republish. */
export async function unpublishCard(
  cardId: string,
): Promise<ApiPublishedCard> {
  return apiFetch<ApiPublishedCard>(`/v1/cards/${cardId}/publish`, {
    method: "DELETE",
  });
}

/**
 * Unauthenticated read for the public card page.
 *
 * `retry: false` because a stranger has no session to refresh — a 404 here is
 * a real answer (unknown or unpublished slug), not an expired token.
 */
export async function fetchPublicCard(
  slug: string,
): Promise<PublicCardResponse> {
  return apiFetch<PublicCardResponse>(
    `/v1/public/cards/${encodeURIComponent(slug)}`,
    { retry: false },
  );
}

/** The URL that goes on a QR code and inside a Wallet pass barcode. */
export function cardShareUrl(slug: string): string {
  return `${window.location.origin}/c/${slug}`;
}
