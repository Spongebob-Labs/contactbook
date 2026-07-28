import { apiFetch } from "@/lib/api";
import {
  getCardPresentation,
  removeCardPresentation,
  setCardPresentation,
  type CardPresentation,
} from "@/lib/card-presentation";
import type {
  ContactCard,
  ContactCardFields,
  ContactCardTemplate,
  ContactCardTheme,
  ContactCardType,
} from "@/lib/types";

export type ApiContactCard = {
  id: string;
  userId: string;
  name: string;
  type: ContactCardType;
  isSensitive?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CardFieldMapping = {
  cardId: string;
  fieldId: string;
};

function mergeCard(
  apiCard: ApiContactCard,
  presentation?: CardPresentation | null,
): ContactCard {
  const local = presentation ?? getCardPresentation(apiCard.id);
  return {
    id: apiCard.id,
    userId: apiCard.userId,
    name: apiCard.name,
    type: apiCard.type,
    createdAt: apiCard.createdAt,
    updatedAt: apiCard.updatedAt,
    ...(apiCard.isSensitive !== undefined
      ? { isSensitive: apiCard.isSensitive }
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
  const created = await apiFetch<ApiContactCard>("/v1/cards", {
    method: "POST",
    body: {
      name: input.name.trim(),
      type: input.type,
    },
  });
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
  const patched = await apiFetch<ApiContactCard>(`/v1/cards/${cardId}`, {
    method: "PATCH",
    body: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.isSensitive !== undefined
        ? { isSensitive: input.isSensitive }
        : {}),
    },
  });
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
