/**
 * WhatsApp card-share domain types.
 *
 * A card is shared as a Meta-approved WhatsApp template message carrying a
 * "Get Contact" button. Tapping it makes the server deliver a `.vcf` built from
 * the card's mapped profile fields. The template copy itself is owned by
 * Twilio/Meta — the app can only pick a body variant and an optional header
 * image, never free-form text.
 */

/** Profile field types that can appear in a shared vCard. */
export const SHAREABLE_FIELD_TYPES = [
  "PHONE",
  "LANDLINE",
  "FAX",
  "EMAIL",
  "ADDRESS",
  "URL",
  "SOCIAL_LINK",
  "PHOTO",
  "JOB_TITLE",
  "COMPANY",
  "DEPARTMENT",
  "DATE",
] as const;

export type ShareableFieldType = (typeof SHAREABLE_FIELD_TYPES)[number];

export function isShareableFieldType(
  value: string,
): value is ShareableFieldType {
  return (SHAREABLE_FIELD_TYPES as readonly string[]).includes(value);
}

/**
 * Canonical order, deduped, with anything the API would reject dropped — a
 * stored or user-built selection can outlive the deploy that removed one of its
 * types.
 */
export function canonicaliseFieldTypes(
  values: readonly unknown[],
): ShareableFieldType[] {
  const wanted = new Set(
    values.filter(
      (value): value is ShareableFieldType =>
        typeof value === "string" && isShareableFieldType(value),
    ),
  );
  return SHAREABLE_FIELD_TYPES.filter((type) => wanted.has(type));
}

/**
 * The `fieldTypes` fragment to spread into a `POST /cards/:id/vcard` or
 * `/share` body.
 *
 * `fieldTypes` is only ever a **filter over the field mappings the card already
 * holds** — it never carries values. The values come from that card's
 * `CardFieldMapping` rows, so narrowing to `["PHONE"]` on a card with no phone
 * mapping yields a name-only VCF rather than an error.
 *
 * The wire convention is the inverse of the UI's, which is the trap this helper
 * exists to close. `VCardGeneratorService` builds its filter as
 * `fieldTypes ? new Set(fieldTypes) : null`, so **omitting** the key includes
 * every mapped field while sending `[]` matches nothing at all. The UI reads an
 * empty selection as "share everything", so an empty array must be dropped from
 * the body, never forwarded.
 *
 * Spread the result — `{ ...fieldTypesBody(types) }` — so an empty selection
 * contributes no key. Every request carrying a field filter goes through here;
 * that is what keeps a future caller from re-inventing the `?.length` check and
 * getting it backwards.
 */
export function fieldTypesBody(
  types: readonly ShareableFieldType[] | undefined,
): { fieldTypes?: ShareableFieldType[] } {
  const filter = canonicaliseFieldTypes(types ?? []);
  return filter.length > 0 ? { fieldTypes: filter } : {};
}

/** Copy + vCard mapping for each shareable field type, for pickers and previews. */
export const SHAREABLE_FIELD_META: Record<
  ShareableFieldType,
  { label: string; vcfProperty: string; hint: string }
> = {
  PHONE: {
    label: "Mobile",
    vcfProperty: "TEL;TYPE=CELL",
    hint: "Saved as a mobile number",
  },
  LANDLINE: {
    label: "Landline",
    vcfProperty: "TEL;TYPE=HOME",
    hint: "Saved as a home number",
  },
  FAX: { label: "Fax", vcfProperty: "TEL;TYPE=FAX", hint: "Saved as a fax number" },
  EMAIL: { label: "Email", vcfProperty: "EMAIL", hint: "Saved as an email address" },
  ADDRESS: { label: "Address", vcfProperty: "ADR", hint: "Saved as a postal address" },
  URL: { label: "Website", vcfProperty: "URL", hint: "Saved as a website link" },
  SOCIAL_LINK: {
    label: "Social link",
    vcfProperty: "URL;TYPE=social",
    hint: "Saved as a social profile link",
  },
  PHOTO: { label: "Photo", vcfProperty: "PHOTO;VALUE=uri", hint: "Saved as the contact photo" },
  JOB_TITLE: { label: "Job title", vcfProperty: "TITLE", hint: "Saved as the job title" },
  COMPANY: { label: "Company", vcfProperty: "ORG", hint: "Saved as the organisation" },
  DEPARTMENT: {
    label: "Department",
    vcfProperty: "ORG",
    hint: "Saved alongside the company",
  },
  DATE: {
    label: "Birthday",
    vcfProperty: "BDAY",
    hint: 'Only included when the label mentions "birth" or "dob"',
  },
};

/** A WhatsApp template that is approved and ready to send. */
export type ShareTemplate = {
  key: string;
  locale: string;
  /** Raw body copy with `{{1}}` sender, `{{2}}` card name, `{{3}}` note placeholders. */
  body: string;
  buttonTitle: string;
  headerImageUrl: string | null;
  syncedAt: string;
  /** Only returned when a template is created; approved templates omit it. */
  approvalStatus?: TemplateApprovalStatus;
  /**
   * How the button delivers the `.vcf`: `URL` downloads it on tap, `QUICK_REPLY`
   * opens a session and the server sends it as a second message. The list
   * endpoint does not send this yet, so it is absent more often than not.
   */
  buttonType?: "URL" | "QUICK_REPLY" | (string & {});
};

export type TemplateApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | (string & {});

/** A body copy option offered when creating a user template. */
export type ShareTemplateVariant = {
  id: string;
  label: string;
  body: string;
  buttonTitle: string;
};

/** Our dispatch pipeline state for a single recipient. */
export type DispatchStatus =
  | "PENDING"
  | "PROCESSING"
  | "DISPATCHED"
  | "RETRYING"
  | "FAILED"
  | (string & {});

/** Twilio → WhatsApp delivery state, updated by status callback. */
export type DeliveryStatus =
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | (string & {});

export type CardShareRecipientInput = {
  /** National number, digits only. */
  phone: string;
  /** E.164 dial code, e.g. "+91". */
  countryCode: string;
  /** Links this recipient to an already-synced contact. */
  contactId?: string;
};

export type CardShareRecipient = {
  id: string;
  countryCode: string;
  phone: string;
  contactId: string | null;
  dispatchStatus: DispatchStatus;
  deliveryStatus: DeliveryStatus | null;
  /** Why the last dispatch attempt failed — worth surfacing next to a retry. */
  lastDispatchError: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  createdAt: string;
};

export type CardShareBatch = {
  id: string;
  /** Null once the underlying card has been deleted. */
  cardId: string | null;
  /** Snapshot taken at send time, so history survives card edits. */
  cardName: string;
  cardType: string;
  note: string | null;
  createdAt: string;
  recipients: CardShareRecipient[];
};

export type CardSharePage = {
  items: CardShareBatch[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type CardVcardAsset = {
  objectKey: string;
  url: string;
  fieldTypes: ShareableFieldType[];
  sizeBytes: number;
};

/** Server-enforced limits, mirrored in the UI so users see them before submitting. */
export const SHARE_LIMITS = {
  maxRecipientsPerBatch: 50,
  minRecipientsPerBatch: 1,
  maxNoteLength: 300,
  /** Unique recipients per user per rolling 24h, across all shares. */
  maxRecipientsPerDay: 50,
  maxUserTemplates: 3,
} as const;

/**
 * The `{{1}}` sender name a recipient sees. Shared so every entry point into the
 * share flow addresses the message the same way — this text goes out over
 * WhatsApp, so a page-local variation is a user-visible inconsistency.
 */
export function shareSenderNameFrom(
  identity: { firstName?: string | null; lastName?: string | null } | null | undefined,
): string {
  const fullName = [identity?.firstName, identity?.lastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  return fullName || "A ContactBook user";
}

/** Terminal dispatch states — polling can stop once every recipient reaches one. */
export function isDispatchSettled(recipient: CardShareRecipient): boolean {
  if (recipient.dispatchStatus === "FAILED") {
    return true;
  }
  if (recipient.dispatchStatus !== "DISPATCHED") {
    return false;
  }
  // Dispatched is only the hand-off; wait for Twilio's delivery callback too.
  return (
    recipient.deliveryStatus === "DELIVERED" ||
    recipient.deliveryStatus === "READ" ||
    recipient.deliveryStatus === "FAILED"
  );
}

export function isBatchSettled(batch: CardShareBatch): boolean {
  return batch.recipients.every(isDispatchSettled);
}

/** A recipient the user can retry — dispatch exhausted its retries. */
export function canResendRecipient(recipient: CardShareRecipient): boolean {
  return (
    recipient.dispatchStatus === "FAILED" || recipient.deliveryStatus === "FAILED"
  );
}
