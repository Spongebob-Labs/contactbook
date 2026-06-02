import { createHash } from "node:crypto";
import { ContactSource } from "@prisma/client";
import vcf from "vcf";
import type { VCard, VCardProperty } from "vcf";
import type { ContactImportSkippedItem } from "./contact-import-skipped.types";
import { ContactImportSkipReason } from "./contact-import-skipped.types";
import {
  hasImportableIdentity,
  normalizedContactToSkippedItem,
} from "./contact-import-identity";
import type {
  NormalizedAddress,
  NormalizedContact,
  NormalizedEmail,
  NormalizedOrganization,
  NormalizedPhone,
  NormalizedUrl,
} from "./normalized-contact.types";

export type VcfParseResult = {
  contacts: NormalizedContact[];
  skipped: ContactImportSkippedItem[];
};

function trimOrNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
}

function propertyValue(prop: VCardProperty | undefined): string | null {
  if (!prop) {
    return null;
  }
  const raw = prop.valueOf();
  return trimOrNull(raw);
}

function propertiesForField(card: VCard, field: string): VCardProperty[] {
  const value = card.get(field);
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function formatTypeLabel(prop: VCardProperty): string | null {
  const type = prop.type;
  if (!type) {
    return null;
  }
  const raw = Array.isArray(type) ? type[0] : type;
  return trimOrNull(String(raw));
}

function primaryIndex(props: VCardProperty[]): number {
  const preferred = props.findIndex((p) => {
    const label = formatTypeLabel(p)?.toLowerCase();
    return label === "pref" || label === "preferred" || label === "primary";
  });
  return preferred >= 0 ? preferred : 0;
}

function parseStructuredName(
  raw: string | null,
): Pick<
  NormalizedContact,
  "firstName" | "lastName" | "middleName" | "namePrefix" | "nameSuffix"
> {
  if (!raw) {
    return {
      firstName: null,
      lastName: null,
      middleName: null,
      namePrefix: null,
      nameSuffix: null,
    };
  }
  const parts = raw.split(";");
  return {
    lastName: trimOrNull(parts[0]),
    firstName: trimOrNull(parts[1]),
    middleName: trimOrNull(parts[2]),
    namePrefix: trimOrNull(parts[3]),
    nameSuffix: trimOrNull(parts[4]),
  };
}

function parsePhones(card: VCard): NormalizedPhone[] {
  const props = propertiesForField(card, "tel");
  const primary = primaryIndex(props);
  return props
    .map((prop, index) => ({
      value: propertyValue(prop) ?? "",
      label: formatTypeLabel(prop),
      isPrimary: index === primary,
    }))
    .filter((p) => p.value.length > 0);
}

function parseEmails(card: VCard): NormalizedEmail[] {
  const props = propertiesForField(card, "email");
  const primary = primaryIndex(props);
  return props
    .map((prop, index) => ({
      value: propertyValue(prop)?.toLowerCase() ?? "",
      label: formatTypeLabel(prop),
      isPrimary: index === primary,
    }))
    .filter((e) => e.value.length > 0);
}

function parseOrganizations(card: VCard): NormalizedOrganization[] {
  const props = propertiesForField(card, "org");
  const primary = primaryIndex(props);
  const organizations: NormalizedOrganization[] = [];
  props.forEach((prop, index) => {
    const raw = propertyValue(prop);
    if (!raw) {
      return;
    }
    const parts = raw.split(";");
    organizations.push({
      companyName: trimOrNull(parts[0]),
      department: trimOrNull(parts[1]),
      title: trimOrNull(parts[2]),
      isPrimary: index === primary,
    });
  });
  return organizations;
}

function parseAddresses(card: VCard): NormalizedAddress[] {
  const props = propertiesForField(card, "adr");
  const primary = primaryIndex(props);
  const addresses: NormalizedAddress[] = [];
  props.forEach((prop, index) => {
    const raw = propertyValue(prop);
    if (!raw) {
      return;
    }
    const parts = raw.split(";");
    addresses.push({
      street: trimOrNull(parts[2]),
      city: trimOrNull(parts[3]),
      region: trimOrNull(parts[4]),
      postalCode: trimOrNull(parts[5]),
      country: trimOrNull(parts[6]),
      label: formatTypeLabel(prop),
      isPrimary: index === primary,
    });
  });
  return addresses;
}

function parseCategories(card: VCard): string[] {
  const names: string[] = [];
  for (const prop of propertiesForField(card, "categories")) {
    const raw = propertyValue(prop);
    if (!raw) {
      continue;
    }
    for (const part of raw.split(",")) {
      const name = part.trim();
      if (name.length > 0) {
        names.push(name);
      }
    }
  }
  return names;
}

function parseUrls(card: VCard): NormalizedUrl[] {
  const urls: NormalizedUrl[] = [];
  for (const prop of propertiesForField(card, "url")) {
    const value = propertyValue(prop);
    if (!value) {
      continue;
    }
    urls.push({ value, label: formatTypeLabel(prop) });
  }
  return urls;
}

function fallbackExternalId(contact: NormalizedContact): string {
  const payload = [
    contact.displayName,
    contact.firstName,
    contact.lastName,
    contact.phones[0]?.value,
    contact.emails[0]?.value,
  ]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
  const hash = createHash("sha256").update(payload).digest("hex");
  return `hash:${hash}`;
}

export function normalizeVcfText(input: string): string {
  const stripped = input.replace(/^\uFEFF/, "").trim();
  if (!stripped) {
    return "";
  }
  return stripped
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, "\r\n");
}

export function parseVcfCards(text: string): VCard[] {
  const normalized = normalizeVcfText(text);
  if (!normalized) {
    return [];
  }
  return vcf.parse(normalized);
}

export function vcardToNormalizedContact(
  card: VCard,
): NormalizedContact | null {
  const contact = buildContactFromCard(card);
  if (!hasImportableIdentity(contact)) {
    return null;
  }
  return contact;
}

function buildContactFromCard(card: VCard): NormalizedContact {
  const uid = propertyValue(propertiesForField(card, "uid")[0]);
  const fn = propertyValue(propertiesForField(card, "fn")[0]);
  const nRaw = propertyValue(propertiesForField(card, "n")[0]);
  const nameParts = parseStructuredName(nRaw);
  const displayName =
    fn ??
    trimOrNull(
      [nameParts.firstName, nameParts.lastName].filter(Boolean).join(" "),
    );
  const phones = parsePhones(card);
  const emails = parseEmails(card);
  const rev = propertyValue(propertiesForField(card, "rev")[0]);

  const contact: NormalizedContact = {
    source: ContactSource.VCARD,
    externalId: uid ?? "",
    sourceRevision: rev,
    displayName,
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    middleName: nameParts.middleName,
    namePrefix: nameParts.namePrefix,
    nameSuffix: nameParts.nameSuffix,
    nickname: propertyValue(propertiesForField(card, "nickname")[0]),
    notes: propertyValue(propertiesForField(card, "note")[0]),
    phones,
    emails,
    organizations: parseOrganizations(card),
    addresses: parseAddresses(card),
    urls: parseUrls(card),
    categories: parseCategories(card),
    deleted: false,
  };

  if (!contact.externalId) {
    contact.externalId = fallbackExternalId(contact);
  }

  return contact;
}

function skippedItemFromCard(
  card: VCard,
  reason: ContactImportSkippedItem["reason"],
): ContactImportSkippedItem {
  const contact = buildContactFromCard(card);
  return normalizedContactToSkippedItem(contact, reason);
}

export function parseVcfImport(text: string): VcfParseResult {
  const cards = parseVcfCards(text);
  const contacts: NormalizedContact[] = [];
  const skipped: ContactImportSkippedItem[] = [];

  for (const card of cards) {
    let contact: NormalizedContact;
    try {
      contact = buildContactFromCard(card);
    } catch {
      skipped.push(
        skippedItemFromCard(card, ContactImportSkipReason.unparseable),
      );
      continue;
    }

    if (!hasImportableIdentity(contact)) {
      skipped.push(
        normalizedContactToSkippedItem(
          contact,
          ContactImportSkipReason.missing_identity,
        ),
      );
      continue;
    }

    contacts.push(contact);
  }

  return { contacts, skipped };
}

/** @deprecated Prefer parseVcfImport for skipped-item reporting. */
export function parseVcfToNormalizedContacts(
  text: string,
): NormalizedContact[] {
  return parseVcfImport(text).contacts;
}
