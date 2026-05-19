import { FieldType } from "@prisma/client";

/** Social labels (lowercase) → JSON key on `/profile/me`. */
export const SOCIAL_LABEL_TO_FIELD: Record<string, string> = {
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

export const SOCIAL_FIELD_TO_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(SOCIAL_LABEL_TO_FIELD).map(([label, key]) => [key, label]),
);

export function labelToCamelCase(label: string): string {
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

export function camelCaseToLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export function normalizeLabelKey(label: string | null | undefined): string {
  return String(label ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** JSON keys handled explicitly for personal (not generic TEXT). */
export const PERSONAL_RESERVED_KEYS = new Set([
  "groupId",
  "tag",
  "custom",
  "postalAddress",
  "mobile",
  "landline",
  "email",
  "dateOfBirth",
  "yearOfBirth",
  "currentLocation",
  "relationshipStatus",
]);

/** One FieldType per key for work/business scalar mapping. */
export const WORK_KEY_TO_TYPE: Record<string, FieldType> = {
  workMobile: FieldType.PHONE,
  workLandline: FieldType.LANDLINE,
  workFax: FieldType.FAX,
  workEmail: FieldType.EMAIL,
  workTitle: FieldType.JOB_TITLE,
  companyName: FieldType.COMPANY,
  companyRegNumber: FieldType.REG_NUMBER,
  companyLogo: FieldType.PHOTO,
  website: FieldType.URL,
};

export const BUSINESS_KEY_TO_TYPE: Record<string, FieldType> = {
  businessMobile: FieldType.PHONE,
  businessLandline: FieldType.LANDLINE,
  businessFax: FieldType.FAX,
  businessEmail: FieldType.EMAIL,
  businessTitle: FieldType.JOB_TITLE,
  businessName: FieldType.COMPANY,
  businessRegNumber: FieldType.REG_NUMBER,
  businessLogo: FieldType.PHOTO,
  website: FieldType.URL,
};

export const GROUP_ITEM_RESERVED_KEYS = new Set(["groupId", "tag", "custom"]);
