import {
  ContactSource,
  FieldType,
  type AddressDetail,
  type ProfileField,
  type User,
} from "@prisma/client";
import { e164FromStoredUser } from "../common/phone.util";
import { contactbookUserExternalId } from "./contactbook-external-id";
import type {
  NormalizedAddress,
  NormalizedContact,
  NormalizedEmail,
  NormalizedOrganization,
  NormalizedPhone,
  NormalizedUrl,
} from "./normalized-contact.types";

export type ProfileFieldWithDetails = ProfileField & {
  address: AddressDetail | null;
};

function trimOrNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function pushPhone(
  phones: NormalizedPhone[],
  value: string | null | undefined,
  label: string | null | undefined,
  isPrimary: boolean,
): void {
  const v = trimOrNull(value);
  if (!v) return;
  phones.push({
    value: v,
    label: trimOrNull(label),
    isPrimary: isPrimary && phones.every((p) => !p.isPrimary),
  });
}

function pushEmail(
  emails: NormalizedEmail[],
  value: string | null | undefined,
  label: string | null | undefined,
  isPrimary: boolean,
): void {
  const v = trimOrNull(value)?.toLowerCase();
  if (!v) return;
  emails.push({
    value: v,
    label: trimOrNull(label),
    isPrimary: isPrimary && emails.every((e) => !e.isPrimary),
  });
}

function addressFromDetail(
  detail: AddressDetail,
  label: string | null | undefined,
  isPrimary: boolean,
): NormalizedAddress {
  return {
    street: trimOrNull(detail.street),
    city: trimOrNull(detail.city),
    region: trimOrNull(detail.state),
    postalCode: trimOrNull(detail.pincode),
    country: trimOrNull(detail.country),
    label: trimOrNull(label),
    isPrimary,
  };
}

/**
 * Maps a contact card's mapped profile fields (non-sensitive) plus user identity
 * into a NormalizedContact for ContactUpsertService.
 */
export function contactCardToNormalizedContact(
  sharer: Pick<
    User,
    "id" | "firstName" | "lastName" | "email" | "phone" | "countryCode"
  >,
  fields: ProfileFieldWithDetails[],
): NormalizedContact {
  const phones: NormalizedPhone[] = [];
  const emails: NormalizedEmail[] = [];
  const organizations: NormalizedOrganization[] = [];
  const addresses: NormalizedAddress[] = [];
  const urls: NormalizedUrl[] = [];
  const textBits: string[] = [];

  let orgDraft: NormalizedOrganization | null = null;
  let orgHasData = false;

  const flushOrg = (isPrimary: boolean): void => {
    if (!orgDraft || !orgHasData) {
      orgDraft = null;
      orgHasData = false;
      return;
    }
    organizations.push({
      ...orgDraft,
      isPrimary: isPrimary && organizations.every((o) => !o.isPrimary),
    });
    orgDraft = null;
    orgHasData = false;
  };

  let fieldIndex = 0;
  for (const field of fields) {
    if (field.isSensitive) {
      continue;
    }
    const label = field.label;
    const isPrimary = fieldIndex === 0;
    fieldIndex += 1;

    switch (field.type) {
      case FieldType.PHONE:
        pushPhone(phones, field.value, label, isPrimary);
        break;
      case FieldType.LANDLINE:
      case FieldType.FAX:
        pushPhone(phones, field.value, label ?? field.type, isPrimary);
        break;
      case FieldType.EMAIL:
        pushEmail(emails, field.value, label, isPrimary);
        break;
      case FieldType.JOB_TITLE:
        orgDraft ??= {};
        orgDraft.title = trimOrNull(field.value);
        orgHasData = true;
        break;
      case FieldType.COMPANY:
        orgDraft ??= {};
        orgDraft.companyName = trimOrNull(field.value);
        orgHasData = true;
        break;
      case FieldType.DEPARTMENT:
        orgDraft ??= {};
        orgDraft.department = trimOrNull(field.value);
        orgHasData = true;
        break;
      case FieldType.ADDRESS:
        if (field.address) {
          flushOrg(false);
          addresses.push(addressFromDetail(field.address, label, isPrimary));
        }
        break;
      case FieldType.URL:
      case FieldType.SOCIAL_LINK:
        {
          const v = trimOrNull(field.value);
          if (v) {
            urls.push({ value: v, label: trimOrNull(label) });
          }
        }
        break;
      case FieldType.TEXT:
      case FieldType.DATE:
      case FieldType.RELATION:
      case FieldType.STATUS:
      case FieldType.CUSTOM:
        {
          const v = trimOrNull(field.value);
          if (v) {
            textBits.push(label ? `${label}: ${v}` : v);
          }
        }
        break;
      default:
        break;
    }
  }
  flushOrg(organizations.length === 0);

  const displayName =
    trimOrNull(`${sharer.firstName} ${sharer.lastName}`.trim()) ??
    trimOrNull(sharer.email);

  if (phones.length === 0) {
    pushPhone(phones, e164FromStoredUser(sharer), "mobile", true);
  }
  if (emails.length === 0 && sharer.email) {
    pushEmail(emails, sharer.email, "email", true);
  }

  return {
    source: ContactSource.CONTACTBOOK,
    externalId: contactbookUserExternalId(sharer.id),
    displayName,
    firstName: trimOrNull(sharer.firstName),
    lastName: trimOrNull(sharer.lastName),
    phones,
    emails,
    organizations,
    addresses,
    urls,
    notes: textBits.length > 0 ? textBits.join("\n") : null,
    deleted: false,
  };
}
