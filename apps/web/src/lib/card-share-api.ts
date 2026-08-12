/**
 * WhatsApp card-share API client.
 *
 * Flow: pick an approved template → POST the share → poll the batch for
 * dispatch/delivery status. The `.vcf` is generated server-side during the
 * share; `generateCardVcard` only exists so the UI can preview it first.
 *
 * Responses are normalised because the live API has shipped more than one shape
 * for these payloads (`items` vs `batches`, `objectKey` vs `key`).
 */
import { apiFetch } from "@/lib/api";
import {
  fieldTypesBody,
  isShareableFieldType,
  type CardSharePage,
  type CardShareBatch,
  type CardShareRecipient,
  type CardShareRecipientInput,
  type CardVcardAsset,
  type ShareTemplate,
  type ShareTemplateVariant,
  type ShareableFieldType,
} from "@/lib/card-share-types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asFieldTypes(value: unknown): ShareableFieldType[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is ShareableFieldType =>
      typeof item === "string" && isShareableFieldType(item),
  );
}

/* -------------------------------------------------------------------------- */
/* Templates                                                                  */
/* -------------------------------------------------------------------------- */

function normalizeTemplate(raw: unknown): ShareTemplate {
  const record = asRecord(raw);
  return {
    key: asString(record.key),
    locale: asString(record.locale, "en"),
    body: asString(record.body ?? record.bodyPreview),
    buttonTitle: asString(record.buttonTitle, "Get Contact"),
    headerImageUrl: asNullableString(record.headerImageUrl),
    syncedAt: asString(record.syncedAt ?? record.createdAt),
    ...(typeof record.buttonType === "string"
      ? { buttonType: record.buttonType }
      : {}),
    ...(typeof record.approvalStatus === "string"
      ? { approvalStatus: record.approvalStatus }
      : {}),
  };
}

/**
 * Templates that are WhatsApp-approved and sendable right now. A template being
 * absent from this list means it is still pending approval.
 */
export async function listShareTemplates(): Promise<ShareTemplate[]> {
  // Uncached: this is how the UI observes a pending template becoming approved.
  const raw = await apiFetch<unknown>("/v1/cards/share-templates", {
    skipCache: true,
  });
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(normalizeTemplate).filter((template) => template.key.length > 0);
}

/** Body copy options a user can pick from when creating their own template. */
export async function listShareTemplateVariants(): Promise<ShareTemplateVariant[]> {
  const raw = await apiFetch<unknown>("/v1/cards/share-templates/variants");
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item): ShareTemplateVariant => {
      const record = asRecord(item);
      return {
        id: asString(record.id),
        label: asString(record.label),
        body: asString(record.body),
        buttonTitle: asString(record.buttonTitle, "Get Contact"),
      };
    })
    .filter((variant) => variant.id.length > 0);
}

/**
 * Submits a new user template to Meta for approval. It only becomes sendable
 * once it shows up in `listShareTemplates()` — the backend sync cron flips
 * `approvalStatus` within a few minutes.
 */
export async function createShareTemplate(input: {
  variant: string;
  image?: File | null;
}): Promise<ShareTemplate> {
  const formData = new FormData();
  formData.append("variant", input.variant);
  if (input.image) {
    formData.append("image", input.image);
  }
  const raw = await apiFetch<unknown>("/v1/cards/share-templates", {
    method: "POST",
    body: formData,
  });
  return normalizeTemplate(raw);
}

/* -------------------------------------------------------------------------- */
/* Share batches                                                              */
/* -------------------------------------------------------------------------- */

function normalizeRecipient(raw: unknown): CardShareRecipient {
  const record = asRecord(raw);
  return {
    id: asString(record.id),
    countryCode: asString(record.countryCode),
    phone: asString(record.phone),
    contactId: asNullableString(record.contactId),
    dispatchStatus: asString(record.dispatchStatus, "PENDING"),
    deliveryStatus: asNullableString(record.deliveryStatus),
    lastDispatchError: asNullableString(record.lastDispatchError),
    sentAt: asNullableString(record.sentAt),
    deliveredAt: asNullableString(record.deliveredAt),
    readAt: asNullableString(record.readAt),
    failedAt: asNullableString(record.failedAt),
    createdAt: asString(record.createdAt),
  };
}

function normalizeBatch(raw: unknown): CardShareBatch {
  const record = asRecord(raw);
  return {
    id: asString(record.id),
    cardId: asNullableString(record.cardId),
    cardName: asString(record.cardName),
    cardType: asString(record.cardType),
    note: asNullableString(record.note),
    createdAt: asString(record.createdAt),
    recipients: Array.isArray(record.recipients)
      ? record.recipients.map(normalizeRecipient)
      : [],
  };
}

/**
 * Queues the card for delivery. Recipients come back `PENDING`; the dispatch
 * cron picks them up within roughly ten seconds.
 *
 * The `.vcf` is built inside this one call — `generateCardVcard` is a preview,
 * not a prerequisite. Passing the same `fieldTypes` to both is what makes the
 * previewed file and the delivered file the same content-addressed object.
 */
export async function shareCard(
  cardId: string,
  input: {
    templateKey: string;
    recipients: CardShareRecipientInput[];
    note?: string;
    fieldTypes?: ShareableFieldType[];
  },
): Promise<CardShareBatch> {
  const note = input.note?.trim();
  const raw = await apiFetch<unknown>(`/v1/cards/${cardId}/share`, {
    method: "POST",
    body: {
      templateKey: input.templateKey,
      recipients: input.recipients.map((recipient) => ({
        phone: recipient.phone,
        countryCode: recipient.countryCode,
        ...(recipient.contactId ? { contactId: recipient.contactId } : {}),
      })),
      ...(note ? { note } : {}),
      // Never `fieldTypes: []` — that filters every field out and sends a
      // name-only card. See `fieldTypesBody`.
      ...fieldTypesBody(input.fieldTypes),
    },
  });
  return normalizeBatch(raw);
}

/**
 * Re-reads a batch so the UI can show updated dispatch/delivery status.
 * Uncached — a cached read would freeze the status the first poll saw.
 */
export async function getCardShareBatch(batchId: string): Promise<CardShareBatch> {
  return normalizeBatch(
    await apiFetch<unknown>(`/v1/card-shares/${batchId}`, { skipCache: true }),
  );
}

/** Puts a failed recipient back to `PENDING` for the next dispatch sweep. */
export async function resendShareRecipient(
  batchId: string,
  recipientId: string,
): Promise<CardShareRecipient> {
  return normalizeRecipient(
    await apiFetch<unknown>(
      `/v1/card-shares/${batchId}/recipients/${recipientId}/resend`,
      { method: "POST" },
    ),
  );
}

/** Share history for one card. The API is 1-indexed. */
export async function listCardShares(
  cardId: string,
  query: { page?: number; limit?: number } = {},
): Promise<CardSharePage> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.max(1, query.limit ?? 20);
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  // Uncached: statuses move underneath this list as the dispatch cron runs.
  const raw = await apiFetch<unknown>(
    `/v1/cards/${cardId}/shares?${params.toString()}`,
    { skipCache: true },
  );
  const record = asRecord(raw);
  const rawItems = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.batches)
      ? record.batches
      : [];
  const items = rawItems.map(normalizeBatch);
  const total = asNumber(record.total, items.length);
  return {
    items,
    page: asNumber(record.page, page),
    limit: asNumber(record.limit, limit),
    total,
    totalPages: Math.max(
      1,
      asNumber(record.totalPages, Math.ceil(total / Math.max(1, limit)) || 1),
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* vCard preview                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Pre-generates the `.vcf` so the UI can show exactly what a recipient receives.
 * Content-addressed: the same card + field selection returns the same URL
 * without re-uploading.
 *
 * Optional for sharing — `shareCard` generates its own. Call this to preview,
 * and to learn what a card actually holds: an unfiltered call returns everything
 * mapped to it, which is the only server-side answer to that question
 * (`VcardAssetResponseDto.fieldTypes` merely echoes the filter sent in).
 */
export async function generateCardVcard(
  cardId: string,
  fieldTypes?: ShareableFieldType[],
): Promise<CardVcardAsset> {
  const raw = await apiFetch<unknown>(`/v1/cards/${cardId}/vcard`, {
    method: "POST",
    body: fieldTypesBody(fieldTypes),
  });
  const record = asRecord(raw);
  return {
    objectKey: asString(record.objectKey ?? record.key),
    url: asString(record.url),
    fieldTypes: asFieldTypes(record.fieldTypes),
    sizeBytes: asNumber(record.sizeBytes, 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Template rendering                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Fills a template body the way the server does at send time, so the preview
 * matches the delivered message.
 *
 * `{{1}}` sender name · `{{2}}` card name · `{{3}}` note. The note collapses to
 * a single space when empty — WhatsApp rejects empty template variables.
 */
export function renderTemplateBody(
  body: string,
  values: { senderName: string; cardName: string; note?: string },
): string {
  const note = values.note?.trim() ? ` ${values.note.trim()}` : " ";
  return body
    .replaceAll("{{1}}", values.senderName)
    .replaceAll("{{2}}", values.cardName)
    .replaceAll("{{3}}", note);
}
