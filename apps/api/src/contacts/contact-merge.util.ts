import type { Contact } from "@prisma/client";
import { normalizeEmail, normalizePhoneForDedup } from "./contact-dedup-index";
import type {
  NormalizedAddress,
  NormalizedContact,
  NormalizedEmail,
  NormalizedOrganization,
  NormalizedPhone,
  NormalizedUrl,
} from "./normalized-contact.types";

export type ContactScalarFields = Pick<
  Contact,
  | "sourceRevision"
  | "displayName"
  | "firstName"
  | "lastName"
  | "middleName"
  | "namePrefix"
  | "nameSuffix"
  | "nickname"
  | "notes"
>;

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0;
}

export function mergeScalarFields(
  existing: Partial<ContactScalarFields>,
  incoming: Partial<ContactScalarFields>,
): ContactScalarFields {
  return {
    sourceRevision: isBlank(existing.sourceRevision)
      ? (incoming.sourceRevision ?? null)
      : (existing.sourceRevision ?? null),
    displayName: isBlank(existing.displayName)
      ? (incoming.displayName ?? null)
      : (existing.displayName ?? null),
    firstName: isBlank(existing.firstName)
      ? (incoming.firstName ?? null)
      : (existing.firstName ?? null),
    lastName: isBlank(existing.lastName)
      ? (incoming.lastName ?? null)
      : (existing.lastName ?? null),
    middleName: isBlank(existing.middleName)
      ? (incoming.middleName ?? null)
      : (existing.middleName ?? null),
    namePrefix: isBlank(existing.namePrefix)
      ? (incoming.namePrefix ?? null)
      : (existing.namePrefix ?? null),
    nameSuffix: isBlank(existing.nameSuffix)
      ? (incoming.nameSuffix ?? null)
      : (existing.nameSuffix ?? null),
    nickname: isBlank(existing.nickname)
      ? (incoming.nickname ?? null)
      : (existing.nickname ?? null),
    notes: isBlank(existing.notes)
      ? (incoming.notes ?? null)
      : (existing.notes ?? null),
  };
}

function phoneKey(value: string, defaultRegion?: string): string {
  return (
    normalizePhoneForDedup(value, defaultRegion) ?? value.replace(/\D/g, "")
  );
}

function emailKey(value: string): string {
  return normalizeEmail(value) ?? value.trim().toLowerCase();
}

function orgKey(org: NormalizedOrganization): string {
  return [
    org.companyName?.trim().toLowerCase() ?? "",
    org.department?.trim().toLowerCase() ?? "",
    org.title?.trim().toLowerCase() ?? "",
  ].join("|");
}

function addressKey(address: NormalizedAddress): string {
  return [
    address.street?.trim().toLowerCase() ?? "",
    address.city?.trim().toLowerCase() ?? "",
    address.region?.trim().toLowerCase() ?? "",
    address.postalCode?.trim().toLowerCase() ?? "",
    address.country?.trim().toLowerCase() ?? "",
  ].join("|");
}

function urlKey(value: string): string {
  return value.trim().toLowerCase();
}

function mergeUnique<T>(
  existing: T[],
  incoming: T[],
  keyFn: (item: T) => string,
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const item of [...existing, ...incoming]) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

export function mergePhones(
  existing: NormalizedPhone[],
  incoming: NormalizedPhone[],
  defaultRegion?: string,
): NormalizedPhone[] {
  return mergeUnique(existing, incoming, (p) =>
    phoneKey(p.value, defaultRegion),
  );
}

export function mergeEmails(
  existing: NormalizedEmail[],
  incoming: NormalizedEmail[],
): NormalizedEmail[] {
  return mergeUnique(existing, incoming, (e) => emailKey(e.value));
}

export function mergeOrganizations(
  existing: NormalizedOrganization[],
  incoming: NormalizedOrganization[],
): NormalizedOrganization[] {
  return mergeUnique(existing, incoming, orgKey);
}

export function mergeAddresses(
  existing: NormalizedAddress[],
  incoming: NormalizedAddress[],
): NormalizedAddress[] {
  return mergeUnique(existing, incoming, addressKey);
}

export function mergeUrls(
  existing: NormalizedUrl[],
  incoming: NormalizedUrl[],
): NormalizedUrl[] {
  return mergeUnique(existing, incoming, (u) => urlKey(u.value));
}

export function mergeNormalizedContactFields(
  existing: NormalizedContact,
  incoming: NormalizedContact,
  defaultRegion?: string,
): NormalizedContact {
  return {
    ...existing,
    ...mergeScalarFields(existing, incoming),
    phones: mergePhones(existing.phones, incoming.phones, defaultRegion),
    emails: mergeEmails(existing.emails, incoming.emails),
    organizations: mergeOrganizations(
      existing.organizations,
      incoming.organizations,
    ),
    addresses: mergeAddresses(existing.addresses, incoming.addresses),
    urls: mergeUrls(existing.urls, incoming.urls),
  };
}

export function contactRowToNormalized(
  row: Contact & {
    phones: Array<{ value: string; label: string | null; isPrimary: boolean }>;
    emails: Array<{ value: string; label: string | null; isPrimary: boolean }>;
    organizations: Array<{
      companyName: string | null;
      department: string | null;
      title: string | null;
      isPrimary: boolean;
    }>;
    addresses: Array<{
      street: string | null;
      city: string | null;
      region: string | null;
      postalCode: string | null;
      country: string | null;
      label: string | null;
      isPrimary: boolean;
    }>;
    urls: Array<{ value: string; label: string | null }>;
  },
): NormalizedContact {
  return {
    source: row.source,
    externalId: row.externalId,
    sourceRevision: row.sourceRevision,
    displayName: row.displayName,
    firstName: row.firstName,
    lastName: row.lastName,
    middleName: row.middleName,
    namePrefix: row.namePrefix,
    nameSuffix: row.nameSuffix,
    nickname: row.nickname,
    notes: row.notes,
    phones: row.phones.map((p) => ({
      value: p.value,
      label: p.label,
      isPrimary: p.isPrimary,
    })),
    emails: row.emails.map((e) => ({
      value: e.value,
      label: e.label,
      isPrimary: e.isPrimary,
    })),
    organizations: row.organizations.map((o) => ({
      companyName: o.companyName,
      department: o.department,
      title: o.title,
      isPrimary: o.isPrimary,
    })),
    addresses: row.addresses.map((a) => ({
      street: a.street,
      city: a.city,
      region: a.region,
      postalCode: a.postalCode,
      country: a.country,
      label: a.label,
      isPrimary: a.isPrimary,
    })),
    urls: row.urls.map((u) => ({ value: u.value, label: u.label })),
  };
}
