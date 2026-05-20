import { FieldType } from "@prisma/client";
import { camelCaseToLabel, labelToCamelCase } from "./profile-me.maps";
import type { FieldWithExtensions } from "./profile-me.flatten";

/** Personal JSON keys that clear a single FieldType when set to null on PATCH. */
export const PERSONAL_KEY_TO_FIELD_TYPE: Record<string, FieldType> = {
  mobile: FieldType.PHONE,
  landline: FieldType.LANDLINE,
  email: FieldType.EMAIL,
  dateOfBirth: FieldType.DATE,
  currentLocation: FieldType.LOCATION_TRACKING,
  relationshipStatus: FieldType.STATUS,
  postalAddress: FieldType.ADDRESS,
};

export function personalNullKeys(
  personal: Record<string, unknown>,
): Set<string> {
  const keys = new Set<string>();
  for (const [key, val] of Object.entries(personal)) {
    if (val === null) {
      keys.add(key);
    }
  }
  if (personal.custom && typeof personal.custom === "object") {
    for (const [label, val] of Object.entries(
      personal.custom as Record<string, unknown>,
    )) {
      if (val === null) {
        keys.add(`custom:${label}`);
      }
    }
  }
  return keys;
}

export function stripPersonalNulls(
  personal: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(personal)) {
    if (val === null) {
      continue;
    }
    if (key === "custom" && val && typeof val === "object") {
      const custom: Record<string, unknown> = {};
      for (const [label, cv] of Object.entries(
        val as Record<string, unknown>,
      )) {
        if (cv !== null) {
          custom[label] = cv;
        }
      }
      if (Object.keys(custom).length > 0) {
        out.custom = custom;
      }
      continue;
    }
    out[key] = val;
  }
  return out;
}

export function fieldMatchesPersonalNullKey(
  field: FieldWithExtensions,
  nullKey: string,
): boolean {
  if (nullKey.startsWith("custom:")) {
    const label = nullKey.slice("custom:".length);
    return (
      field.type === FieldType.CUSTOM &&
      (field.label?.trim() || "") === label.trim()
    );
  }

  if (nullKey === "yearOfBirth") {
    return (
      field.type === FieldType.TEXT &&
      (field.label?.trim() || "").toLowerCase() === "year of birth"
    );
  }

  const expectedType = PERSONAL_KEY_TO_FIELD_TYPE[nullKey];
  if (expectedType) {
    if (field.type === expectedType) {
      if (nullKey === "relationshipStatus") {
        return (
          field.type === FieldType.STATUS || field.type === FieldType.RELATION
        );
      }
      return true;
    }
    if (nullKey === "relationshipStatus" && field.type === FieldType.RELATION) {
      return true;
    }
  }

  if (field.type === FieldType.TEXT && field.label?.trim()) {
    return labelToCamelCase(field.label) === nullKey;
  }

  return false;
}

export function customLabelFromNullKey(nullKey: string): string | null {
  if (nullKey.startsWith("custom:")) {
    return nullKey.slice("custom:".length);
  }
  return null;
}

export { camelCaseToLabel };
