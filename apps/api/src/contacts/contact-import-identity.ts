import type { NormalizedContact } from "./normalized-contact.types";
import type { ContactImportSkippedItem } from "./contact-import-skipped.types";

export function hasImportableIdentity(contact: NormalizedContact): boolean {
  return Boolean(
    contact.displayName ||
    contact.firstName ||
    contact.lastName ||
    contact.phones.length > 0 ||
    contact.emails.length > 0,
  );
}

export function normalizedContactToSkippedItem(
  contact: NormalizedContact,
  reason: ContactImportSkippedItem["reason"],
): ContactImportSkippedItem {
  const primaryPhone =
    contact.phones.find((p) => p.isPrimary)?.value ??
    contact.phones[0]?.value ??
    null;
  const primaryEmail =
    contact.emails.find((e) => e.isPrimary)?.value ??
    contact.emails[0]?.value ??
    null;

  return {
    externalId: contact.externalId || null,
    displayName: contact.displayName ?? null,
    firstName: contact.firstName ?? null,
    lastName: contact.lastName ?? null,
    primaryPhone,
    primaryEmail,
    reason,
  };
}
