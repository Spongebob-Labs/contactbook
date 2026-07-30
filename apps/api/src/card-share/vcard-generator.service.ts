import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { ContactCard, FieldType, VCardAsset } from "@prisma/client";
import VCard from "vcf";
import { PrismaService } from "../prisma/prisma.service";
import { GcsVcardService } from "../storage/gcs-vcard.service";

/** FieldTypes with no vCard equivalent, or too sensitive to push into a phone's address book. */
const EXCLUDED_FIELD_TYPES = new Set<FieldType>([
  "REG_NUMBER",
  "RELATION",
  "STATUS",
  "LOCATION_TRACKING",
  "BANK_ACCOUNT",
  "DIGITAL_WALLET",
  "CRYPTO_WALLET",
  "CUSTOM",
]);

export type VCardOwnerInput = {
  firstName: string;
  lastName: string;
};

export type VCardFieldInput = {
  groupId: string;
  type: FieldType;
  label: string | null;
  isSensitive: boolean;
  value: string | null;
  address: {
    street: string;
    city: string;
    state: string | null;
    pincode: string | null;
    country: string;
  } | null;
};

export type SerializedVCard = {
  buffer: Buffer;
  contentHash: string;
};

/** Escapes vCard TEXT-value special characters (RFC 6350 §3.4): backslash, comma, semicolon, newline. */
function escapeVcardText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r?\n/g, "\\n");
}

/** Heuristic: only DATE fields explicitly labeled as a birthday map to BDAY, not any arbitrary date. */
function isBirthdayLabel(label: string | null): boolean {
  if (!label) return false;
  const normalized = label.toLowerCase();
  return normalized.includes("birth") || normalized.includes("dob");
}

/** Only reference an already-hosted photo by URL; never embed image bytes into the vCard. */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Pure vCard 3.0 serialization from a card's mapped fields — no DB/GCS I/O, independently
 * unit-testable. Sensitive fields and FieldTypes with no vCard equivalent are dropped.
 */
export function serializeCard(
  owner: VCardOwnerInput,
  fields: VCardFieldInput[],
): SerializedVCard {
  const card = new VCard();

  const fullName = `${owner.firstName} ${owner.lastName}`.trim();
  card.set("fn", escapeVcardText(fullName));
  card.set(
    "n",
    [owner.lastName, owner.firstName, "", "", ""].map(escapeVcardText),
  );

  const orgByGroup = new Map<
    string,
    { company?: string; department?: string }
  >();

  for (const field of fields) {
    if (field.isSensitive || EXCLUDED_FIELD_TYPES.has(field.type)) {
      continue;
    }

    switch (field.type) {
      case "PHONE":
        if (field.value) {
          card.add("tel", escapeVcardText(field.value), { type: "CELL" });
        }
        break;
      case "LANDLINE":
        if (field.value) {
          card.add("tel", escapeVcardText(field.value), { type: "HOME" });
        }
        break;
      case "FAX":
        if (field.value) {
          card.add("tel", escapeVcardText(field.value), { type: "FAX" });
        }
        break;
      case "EMAIL":
        if (field.value) {
          card.add("email", escapeVcardText(field.value));
        }
        break;
      case "ADDRESS":
        if (field.address) {
          card.add("adr", [
            "",
            "",
            escapeVcardText(field.address.street),
            escapeVcardText(field.address.city),
            escapeVcardText(field.address.state ?? ""),
            escapeVcardText(field.address.pincode ?? ""),
            escapeVcardText(field.address.country),
          ]);
        }
        break;
      case "URL":
        if (field.value) {
          card.add("url", escapeVcardText(field.value));
        }
        break;
      case "SOCIAL_LINK":
        if (field.value) {
          card.add("url", escapeVcardText(field.value), { type: "social" });
        }
        break;
      case "PHOTO":
        if (field.value && isHttpsUrl(field.value)) {
          card.add("photo", field.value, { value: "uri" });
        }
        break;
      case "JOB_TITLE":
        if (field.value) {
          card.add("title", escapeVcardText(field.value));
        }
        break;
      case "COMPANY":
      case "DEPARTMENT":
        // Paired by groupId below so "Company" + "Department" fields from the same
        // FieldGroup (e.g. one workplace) collapse into a single ORG property.
        if (field.value) {
          const entry = orgByGroup.get(field.groupId) ?? {};
          if (field.type === "COMPANY") {
            entry.company = field.value;
          } else {
            entry.department = field.value;
          }
          orgByGroup.set(field.groupId, entry);
        }
        break;
      case "DATE":
        if (field.value && isBirthdayLabel(field.label)) {
          card.add("bday", field.value);
        }
        break;
      default:
        break;
    }
  }

  for (const { company, department } of orgByGroup.values()) {
    const parts = [company, department]
      .filter((part): part is string => Boolean(part))
      .map(escapeVcardText);
    if (parts.length > 0) {
      card.add("org", parts);
    }
  }

  const buffer = Buffer.from(card.toString("3.0"), "utf-8");
  const contentHash = createHash("sha256").update(buffer).digest("hex");
  return { buffer, contentHash };
}

@Injectable()
export class VCardGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gcsVcard: GcsVcardService,
  ) {}

  async getOrCreateAsset(
    userId: string,
    card: ContactCard,
  ): Promise<VCardAsset> {
    const [owner, mappings] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      }),
      this.prisma.cardFieldMapping.findMany({
        where: { cardId: card.id },
        include: { field: { include: { address: true } } },
      }),
    ]);

    const fields: VCardFieldInput[] = mappings.map(({ field }) => ({
      groupId: field.groupId,
      type: field.type,
      label: field.label,
      isSensitive: field.isSensitive,
      value: field.value,
      address: field.address,
    }));

    const { buffer, contentHash } = serializeCard(owner, fields);

    const existing = await this.prisma.vCardAsset.findFirst({
      where: { cardId: card.id, contentHash },
    });
    if (existing) {
      return existing;
    }

    const objectKey = `${card.id}/${contentHash}.vcf`;
    const storageUrl = await this.gcsVcard.upload(objectKey, buffer);

    return this.prisma.vCardAsset.create({
      data: {
        cardId: card.id,
        contentHash,
        storageUrl,
        objectKey,
        sizeBytes: buffer.byteLength,
        // WhatsApp only accepts text/x-vcard (not text/vcard) — see gcs-vcard.service.ts.
        // Set explicitly rather than relying on the schema's stale text/vcard default.
        mimeType: "text/x-vcard",
      },
    });
  }
}
