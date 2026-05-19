import { FieldType } from "@prisma/client";
import {
  BUSINESS_KEY_TO_TYPE,
  camelCaseToLabel,
  GROUP_ITEM_RESERVED_KEYS,
  labelToCamelCase,
  PERSONAL_RESERVED_KEYS,
  SOCIAL_FIELD_TO_LABEL,
  WORK_KEY_TO_TYPE,
} from "./profile-me.maps";
import type {
  FieldSpec,
  InflatedFinancialRow,
  InflatedGroupItem,
} from "./profile-me.field-spec";
import type { PostalAddress } from "./profile-me.types";

function str(v: unknown): string | null {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v === "object") {
    return JSON.stringify(v);
  }
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(v);
}

function addressFromPayload(raw: unknown): FieldSpec["address"] | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const a = raw as PostalAddress;
  if (!a.street || !a.city || !a.country) {
    return undefined;
  }
  return {
    street: a.street,
    city: a.city,
    state: a.state ?? null,
    pincode: a.pincode ?? null,
    country: a.country,
  };
}

function customFields(custom: unknown): FieldSpec[] {
  if (!custom || typeof custom !== "object") {
    return [];
  }
  return Object.entries(custom as Record<string, string>).map(
    ([label, value]) => ({
      type: FieldType.CUSTOM,
      label,
      value: value ?? "",
    }),
  );
}

function scalarSpec(
  type: FieldType,
  value: unknown,
  label?: string,
): FieldSpec | null {
  const v = str(value);
  if (v === null && type !== FieldType.LOCATION_TRACKING) {
    return null;
  }
  return { type, label: label ?? null, value: v };
}

function inflateGroupItem(
  item: Record<string, unknown>,
  ctx: "work" | "business",
): InflatedGroupItem {
  const tag = str(item.tag)?.trim() || "Untitled";
  const groupId = str(item.groupId) ?? undefined;
  const fields: FieldSpec[] = [...customFields(item.custom)];

  const keyMap = ctx === "work" ? WORK_KEY_TO_TYPE : BUSINESS_KEY_TO_TYPE;
  const addressKey =
    ctx === "work" ? "workPostalAddress" : "businessPostalAddress";

  const addr = addressFromPayload(item[addressKey]);
  if (addr) {
    fields.push({ type: FieldType.ADDRESS, address: addr });
  }

  for (const [key, type] of Object.entries(keyMap)) {
    if (key in item && item[key] !== undefined) {
      if (type === FieldType.URL && key === "website") {
        fields.push({
          type: FieldType.URL,
          label: "website",
          value: str(item[key]),
        });
      } else if (type === FieldType.PHOTO) {
        fields.push({ type: FieldType.PHOTO, value: str(item[key]) });
      } else {
        const spec = scalarSpec(type, item[key]);
        if (spec) {
          fields.push(spec);
        }
      }
    }
  }

  for (const [key, val] of Object.entries(item)) {
    if (
      GROUP_ITEM_RESERVED_KEYS.has(key) ||
      key in keyMap ||
      key === addressKey
    ) {
      continue;
    }
    if (val !== undefined && val !== null && typeof val !== "object") {
      fields.push({
        type: FieldType.TEXT,
        label: camelCaseToLabel(key),
        value: str(val),
      });
    }
  }

  return { tag, groupId, fields };
}

export function inflateWorkItem(
  item: Record<string, unknown>,
): InflatedGroupItem {
  return inflateGroupItem(item, "work");
}

export function inflateBusinessItem(
  item: Record<string, unknown>,
): InflatedGroupItem {
  return inflateGroupItem(item, "business");
}

export function inflateSocialItem(
  item: Record<string, unknown>,
): InflatedGroupItem {
  const tag = str(item.tag)?.trim() || "Untitled";
  const groupId = str(item.groupId) ?? undefined;
  const fields: FieldSpec[] = [...customFields(item.custom)];

  for (const [jsonKey, label] of Object.entries(SOCIAL_FIELD_TO_LABEL)) {
    if (item[jsonKey] !== undefined) {
      fields.push({
        type: FieldType.SOCIAL_LINK,
        label,
        value: str(item[jsonKey]),
      });
    }
  }

  for (const [key, val] of Object.entries(item)) {
    if (GROUP_ITEM_RESERVED_KEYS.has(key) || key in SOCIAL_FIELD_TO_LABEL) {
      continue;
    }
    if (val !== undefined && val !== null && typeof val !== "object") {
      fields.push({
        type: FieldType.SOCIAL_LINK,
        label: camelCaseToLabel(key),
        value: str(val),
      });
    }
  }

  return { tag, groupId, fields };
}

export function inflatePersonal(
  item: Record<string, unknown>,
): InflatedGroupItem {
  const tag = str(item.tag)?.trim() || "Primary Personal Details";
  const groupId = str(item.groupId) ?? undefined;
  const fields: FieldSpec[] = [...customFields(item.custom)];

  const addr = addressFromPayload(item.postalAddress);
  if (addr) {
    fields.push({ type: FieldType.ADDRESS, address: addr });
  }

  if (item.mobile !== undefined) {
    const s = scalarSpec(FieldType.PHONE, item.mobile);
    if (s) {
      fields.push(s);
    }
  }
  if (item.landline !== undefined) {
    const s = scalarSpec(FieldType.LANDLINE, item.landline);
    if (s) {
      fields.push(s);
    }
  }
  if (item.email !== undefined) {
    const s = scalarSpec(FieldType.EMAIL, item.email);
    if (s) {
      fields.push(s);
    }
  }
  if (item.dateOfBirth !== undefined) {
    const s = scalarSpec(FieldType.DATE, item.dateOfBirth);
    if (s) {
      fields.push(s);
    }
  }
  if (item.currentLocation !== undefined) {
    const s = scalarSpec(FieldType.LOCATION_TRACKING, item.currentLocation);
    if (s) {
      fields.push(s);
    }
  }
  if (item.relationshipStatus !== undefined) {
    const s = scalarSpec(FieldType.STATUS, item.relationshipStatus);
    if (s) {
      fields.push(s);
    }
  }

  for (const [key, val] of Object.entries(item)) {
    if (PERSONAL_RESERVED_KEYS.has(key)) {
      continue;
    }
    if (val !== undefined && val !== null && typeof val !== "object") {
      fields.push({
        type: FieldType.TEXT,
        label: camelCaseToLabel(key),
        value: str(val),
      });
    }
  }

  return { tag, groupId, fields };
}

export function inflateIdentityPhoto(
  identity: Record<string, unknown>,
): FieldSpec | null {
  if (identity.profilePhoto === undefined) {
    return null;
  }
  const v = str(identity.profilePhoto);
  if (v === null) {
    return { type: FieldType.PHOTO, value: null };
  }
  return { type: FieldType.PHOTO, value: v };
}

export function inflateBankRow(
  row: Record<string, unknown>,
): InflatedFinancialRow | null {
  const tag = str(row.tag)?.trim();
  if (!tag) {
    return null;
  }
  const bankName = str(row.bankName);
  const accountHolder = str(row.accountHolder);
  const accountNumber = str(row.accountNumber);
  if (!bankName || !accountHolder || !accountNumber) {
    return null;
  }
  return {
    fieldId: str(row.fieldId) ?? undefined,
    groupId: str(row.groupId) ?? undefined,
    tag,
    field: {
      type: FieldType.BANK_ACCOUNT,
      isSensitive: row.isSensitive === false ? false : true,
      bankAccount: {
        bankName,
        accountHolder,
        accountNumber,
        iban: str(row.iban),
        swiftBic: str(row.swiftBic),
        routingNumber: str(row.routingNumber),
        ifsc: str(row.ifsc),
        currency: str(row.currency) ?? "USD",
      },
    },
  };
}

export function inflateWalletRow(
  row: Record<string, unknown>,
): InflatedFinancialRow | null {
  const tag = str(row.tag)?.trim();
  const platform = str(row.platform);
  const handleOrLink = str(row.handleOrLink);
  if (!tag || !platform || !handleOrLink) {
    return null;
  }
  return {
    fieldId: str(row.fieldId) ?? undefined,
    groupId: str(row.groupId) ?? undefined,
    tag,
    field: {
      type: FieldType.DIGITAL_WALLET,
      isSensitive: row.isSensitive === false ? false : true,
      digitalWallet: { platform, handleOrLink },
    },
  };
}

export function inflateCryptoRow(
  row: Record<string, unknown>,
): InflatedFinancialRow | null {
  const tag = str(row.tag)?.trim();
  const network = str(row.network);
  const address = str(row.address);
  if (!tag || !network || !address) {
    return null;
  }
  return {
    fieldId: str(row.fieldId) ?? undefined,
    groupId: str(row.groupId) ?? undefined,
    tag,
    field: {
      type: FieldType.CRYPTO_WALLET,
      isSensitive: row.isSensitive === false ? false : true,
      cryptoWallet: { network, address },
    },
  };
}

/** Map TEXT field label back to camelCase key for round-trip tests. */
export { labelToCamelCase };
