import {
  type AddressDetail,
  type BankAccountDetail,
  type CryptoWalletDetail,
  type DigitalWalletDetail,
  FieldCategory,
  type FieldGroup,
  FieldType,
  type ProfileField,
} from "@prisma/client";
import { e164FromStoredUser } from "../common/phone.util";
import type {
  ProfileMeBusinessItem,
  ProfileMeIdentity,
  ProfileMeWorkItem,
} from "./profile-me.types";

export type FieldWithExtensions = ProfileField & {
  address: AddressDetail | null;
  bankAccount: BankAccountDetail | null;
  digitalWallet: DigitalWalletDetail | null;
  cryptoWallet: CryptoWalletDetail | null;
};

export type GroupWithFields = FieldGroup & { fields: FieldWithExtensions[] };

export type FlattenContext = "identity" | "personal" | "work" | "business";

/** User row fields needed for `/profile/me` identity. */
export type UserIdentityRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
};

export function primaryPhoneFromUserSafe(user: UserIdentityRow): string {
  try {
    return e164FromStoredUser(user);
  } catch {
    const cc = String(user.countryCode ?? "").trim();
    const n = String(user.phone ?? "").replace(/\D/g, "");
    const prefix = cc.startsWith("+")
      ? cc
      : cc
        ? `+${cc.replace(/\D/g, "")}`
        : "";
    return `${prefix}${n}` || "";
  }
}

export function extensionPayload(
  field: FieldWithExtensions,
): Record<string, unknown> {
  if (field.address) {
    const a = field.address;
    return {
      street: a.street,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      country: a.country,
    };
  }
  if (field.bankAccount) {
    const b = field.bankAccount;
    return {
      bankName: b.bankName,
      accountHolder: b.accountHolder,
      accountNumber: b.accountNumber,
      iban: b.iban,
      swiftBic: b.swiftBic,
      routingNumber: b.routingNumber,
      ifsc: b.ifsc,
      currency: b.currency,
    };
  }
  if (field.digitalWallet) {
    const d = field.digitalWallet;
    return { platform: d.platform, handleOrLink: d.handleOrLink };
  }
  if (field.cryptoWallet) {
    const c = field.cryptoWallet;
    return { network: c.network, address: c.address };
  }
  return {};
}

function labelToCamelCase(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "text";
  }
  return (
    parts[0].toLowerCase() +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join("")
  );
}

function normalizeLabelKey(label: string | null | undefined): string {
  return String(label ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Known social labels → fixed JSON keys (label compared lowercase). */
const SOCIAL_LABEL_TO_FIELD: Record<string, string> = {
  skype: "skype",
  facebook: "facebook",
  twitter: "twitter",
  "x (twitter)": "twitter",
  x: "twitter",
  "bbm pin": "bbmPin",
  bbm: "bbmPin",
  whatsapp: "whatsApp",
  asw: "asw",
  bebo: "bebo",
  blog: "blog",
  website: "website",
  site: "website",
  homepage: "website",
};

function scalarValue(field: FieldWithExtensions): string | null {
  if (field.value === null || field.value === undefined) {
    return null;
  }
  return field.value;
}

function applyDateOfBirth(
  target: Record<string, unknown>,
  isoOrRaw: string | null,
): void {
  if (!isoOrRaw) {
    target.dateOfBirth = null;
    return;
  }
  target.dateOfBirth = isoOrRaw;
  const m = /^(\d{4})-\d{2}-\d{2}/.exec(isoOrRaw.trim());
  if (m) {
    target.yearOfBirth = m[1]!;
  }
}

/**
 * Flattens one profile field into key/value(s) for the given layout context.
 * Returns entries to merge into a group payload (not including groupId/tag).
 */
export function flattenFieldForContext(
  field: FieldWithExtensions,
  ctx: FlattenContext,
): Record<string, unknown> | null {
  if (field.type === FieldType.CUSTOM) {
    return null;
  }

  if (ctx === "identity") {
    if (field.type === FieldType.PHOTO) {
      const v = scalarValue(field);
      return v !== null ? { profilePhoto: v } : { profilePhoto: null };
    }
    if (field.type === FieldType.URL) {
      const v = scalarValue(field);
      return v !== null ? { profilePhoto: v } : { profilePhoto: null };
    }
    if (field.type === FieldType.EMAIL) {
      const v = scalarValue(field);
      return v !== null ? { primaryEmail: v } : { primaryEmail: null };
    }
    if (field.type === FieldType.PHONE) {
      const v = scalarValue(field);
      return v !== null ? { primaryPhone: v } : { primaryPhone: null };
    }
    return null;
  }

  if (ctx === "personal") {
    if (field.type === FieldType.ADDRESS) {
      return { postalAddress: extensionPayload(field) };
    }
    if (field.type === FieldType.PHONE) {
      const v = scalarValue(field);
      return { mobile: v };
    }
    if (field.type === FieldType.LANDLINE) {
      const v = scalarValue(field);
      return { landline: v };
    }
    if (field.type === FieldType.EMAIL) {
      const v = scalarValue(field);
      return { email: v };
    }
    if (field.type === FieldType.DATE) {
      const out: Record<string, unknown> = {};
      applyDateOfBirth(out, scalarValue(field));
      return out;
    }
    if (field.type === FieldType.LOCATION_TRACKING) {
      const raw = scalarValue(field);
      if (raw === null) {
        return { currentLocation: null };
      }
      const lower = raw.toLowerCase();
      if (lower === "true" || lower === "false") {
        return { currentLocation: lower };
      }
      return { currentLocation: raw };
    }
    if (field.type === FieldType.RELATION || field.type === FieldType.STATUS) {
      const v = scalarValue(field);
      return { relationshipStatus: v };
    }
    if (field.type === FieldType.TEXT) {
      const label = field.label?.trim();
      if (!label) {
        return null;
      }
      return { [labelToCamelCase(label)]: scalarValue(field) };
    }
    return null;
  }

  if (ctx === "work") {
    if (field.type === FieldType.ADDRESS) {
      return { workPostalAddress: extensionPayload(field) };
    }
    if (field.type === FieldType.PHONE) {
      return { workMobile: scalarValue(field) };
    }
    if (field.type === FieldType.LANDLINE) {
      return { workLandline: scalarValue(field) };
    }
    if (field.type === FieldType.FAX) {
      return { workFax: scalarValue(field) };
    }
    if (field.type === FieldType.EMAIL) {
      return { workEmail: scalarValue(field) };
    }
    if (field.type === FieldType.JOB_TITLE) {
      return { workTitle: scalarValue(field) };
    }
    if (field.type === FieldType.COMPANY) {
      return { companyName: scalarValue(field) };
    }
    if (field.type === FieldType.REG_NUMBER) {
      return { companyRegNumber: scalarValue(field) };
    }
    if (field.type === FieldType.PHOTO) {
      return { companyLogo: scalarValue(field) };
    }
    if (field.type === FieldType.URL) {
      const label = normalizeLabelKey(field.label);
      if (label.includes("logo")) {
        return { companyLogo: scalarValue(field) };
      }
      return { website: scalarValue(field) };
    }
    if (field.type === FieldType.TEXT && field.label?.trim()) {
      return { [labelToCamelCase(field.label)]: scalarValue(field) };
    }
    return null;
  }

  if (ctx === "business") {
    if (field.type === FieldType.ADDRESS) {
      return { businessPostalAddress: extensionPayload(field) };
    }
    if (field.type === FieldType.PHONE) {
      return { businessMobile: scalarValue(field) };
    }
    if (field.type === FieldType.LANDLINE) {
      return { businessLandline: scalarValue(field) };
    }
    if (field.type === FieldType.FAX) {
      return { businessFax: scalarValue(field) };
    }
    if (field.type === FieldType.EMAIL) {
      return { businessEmail: scalarValue(field) };
    }
    if (field.type === FieldType.JOB_TITLE) {
      return { businessTitle: scalarValue(field) };
    }
    if (field.type === FieldType.COMPANY) {
      return { businessName: scalarValue(field) };
    }
    if (field.type === FieldType.REG_NUMBER) {
      return { businessRegNumber: scalarValue(field) };
    }
    if (field.type === FieldType.PHOTO) {
      return { businessLogo: scalarValue(field) };
    }
    if (field.type === FieldType.URL) {
      const label = normalizeLabelKey(field.label);
      if (label.includes("logo")) {
        return { businessLogo: scalarValue(field) };
      }
      return { website: scalarValue(field) };
    }
    if (field.type === FieldType.TEXT && field.label?.trim()) {
      return { [labelToCamelCase(field.label)]: scalarValue(field) };
    }
    return null;
  }

  return null;
}

function mergeGroupFields(
  group: GroupWithFields,
  ctx: FlattenContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const customNested: Record<string, string> = {};
  for (const field of group.fields) {
    if (field.type === FieldType.CUSTOM) {
      if (ctx === "identity") {
        continue;
      }
      const k =
        (field.label && field.label.trim()) || `custom_${field.id.slice(0, 8)}`;
      customNested[k] = field.value ?? "";
      continue;
    }
    const part = flattenFieldForContext(field, ctx);
    if (part) {
      Object.assign(out, part);
    }
  }
  if (Object.keys(customNested).length > 0) {
    out.custom = customNested;
  }
  return out;
}

export function groupToWorkItem(group: GroupWithFields): ProfileMeWorkItem {
  const flat = mergeGroupFields(group, "work");
  return {
    groupId: group.id,
    tag: group.name,
    ...flat,
  };
}

export function groupToBusinessItem(
  group: GroupWithFields,
): ProfileMeBusinessItem {
  const flat = mergeGroupFields(group, "business");
  return {
    groupId: group.id,
    tag: group.name,
    ...flat,
  };
}

/**
 * Merges all IDENTITY groups (ascending `updatedAt` so later groups win),
 * then overlays canonical `User` fields for core identity.
 */
export function buildIdentity(
  user: UserIdentityRow,
  identityGroups: GroupWithFields[],
): ProfileMeIdentity {
  const ordered = [...identityGroups].sort(
    (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime(),
  );
  const merged: Record<string, unknown> = {};
  for (const g of ordered) {
    Object.assign(merged, mergeGroupFields(g, "identity"));
  }

  const out: ProfileMeIdentity = {
    firstName: user.firstName,
    lastName: user.lastName,
    primaryEmail: user.email,
    primaryPhone: primaryPhoneFromUserSafe(user),
  };

  const profilePhoto = merged.profilePhoto;
  if (typeof profilePhoto === "string") {
    out.profilePhoto = profilePhoto;
  } else if (profilePhoto === null) {
    out.profilePhoto = null;
  }
  return out;
}

/**
 * Primary PERSONAL group = most recently updated. Merges all personal groups
 * (ascending `updatedAt` for field last-wins), then sets `groupId`/`tag` from primary.
 */
export function mergePersonalGroups(
  groups: GroupWithFields[],
): Record<string, unknown> {
  if (!groups.length) {
    return { groupId: "", tag: "" };
  }
  const primary = [...groups].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  )[0];

  const ordered = [...groups].sort(
    (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime(),
  );
  const merged: Record<string, unknown> = {};
  for (const g of ordered) {
    const flat = mergeGroupFields(g, "personal");
    const nestedCustom = flat.custom as Record<string, string> | undefined;
    delete flat.custom;
    Object.assign(merged, flat);
    if (nestedCustom) {
      const existing = (merged.custom as Record<string, string>) ?? {};
      merged.custom = { ...existing, ...nestedCustom };
    }
  }

  merged.groupId = primary.id;
  merged.tag = primary.name;
  return merged;
}

function socialFieldKey(field: FieldWithExtensions): string | null {
  const label = field.label?.trim();
  if (!label) {
    return null;
  }
  const nk = normalizeLabelKey(label);
  return SOCIAL_LABEL_TO_FIELD[nk] ?? null;
}

export function groupToSocialItem(
  group: GroupWithFields,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    groupId: group.id,
    tag: group.name,
  };
  const customNested: Record<string, string> = {};

  for (const field of group.fields) {
    if (field.type === FieldType.CUSTOM) {
      const k =
        (field.label && field.label.trim()) || `custom_${field.id.slice(0, 8)}`;
      customNested[k] = field.value ?? "";
      continue;
    }

    const v = scalarValue(field) ?? "";
    if (
      field.type === FieldType.SOCIAL_LINK ||
      field.type === FieldType.URL ||
      field.type === FieldType.TEXT
    ) {
      const mapped = socialFieldKey(field);
      if (mapped) {
        out[mapped] = v || null;
      } else if (field.label?.trim()) {
        customNested[field.label.trim()] = v;
      }
    }
  }

  if (Object.keys(customNested).length > 0) {
    const existing = out.custom as Record<string, string> | undefined;
    out.custom = { ...(existing ?? {}), ...customNested };
  }

  return out;
}

export function categoryToResponseKey(
  category: FieldCategory,
):
  | "identity"
  | "personal"
  | "work"
  | "business"
  | "socials"
  | "financial"
  | null {
  switch (category) {
    case FieldCategory.IDENTITY:
      return "identity";
    case FieldCategory.PERSONAL:
      return "personal";
    case FieldCategory.WORK:
      return "work";
    case FieldCategory.BUSINESS:
      return "business";
    case FieldCategory.SOCIAL:
      return "socials";
    case FieldCategory.FINANCIAL:
      return "financial";
    default:
      return null;
  }
}
