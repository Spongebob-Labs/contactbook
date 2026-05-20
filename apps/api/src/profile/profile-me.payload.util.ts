import type { ProfileMePatchDto } from "./dto/profile-me-upsert.dto";
import { PERSONAL_KEY_TO_FIELD_TYPE } from "./profile-me.personal-null";

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isEmptyAddress(addr: unknown): boolean {
  if (addr === null || addr === undefined) {
    return true;
  }
  if (typeof addr !== "object") {
    return true;
  }
  const a = addr as Record<string, unknown>;
  return !hasText(a.street) && !hasText(a.city) && !hasText(a.country);
}

function hasPersonalScalars(personal: Record<string, unknown>): boolean {
  for (const [key, val] of Object.entries(personal)) {
    if (
      key === "groupId" ||
      key === "tag" ||
      key === "custom" ||
      key === "postalAddress"
    ) {
      continue;
    }
    if (val !== undefined && val !== null) {
      return true;
    }
  }
  return false;
}

function safeString(v: unknown): string {
  if (
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  ) {
    return String(v);
  }
  return "";
}

function hasCustomEntries(custom: unknown): boolean {
  if (!custom || typeof custom !== "object") {
    return false;
  }
  return Object.values(custom as Record<string, unknown>).some(
    (v) => v !== undefined && v !== null && hasText(safeString(v)),
  );
}

function hasPersonalFieldNullClears(
  personal: Record<string, unknown>,
): boolean {
  if (personal.postalAddress === null) {
    return true;
  }
  if (personal.yearOfBirth === null) {
    return true;
  }
  for (const key of Object.keys(PERSONAL_KEY_TO_FIELD_TYPE)) {
    if (personal[key] === null) {
      return true;
    }
  }
  if (personal.custom && typeof personal.custom === "object") {
    return Object.values(personal.custom as Record<string, unknown>).some(
      (v) => v === null,
    );
  }
  return false;
}

function isEmptyPersonal(personal: Record<string, unknown>): boolean {
  if (hasPersonalFieldNullClears(personal)) {
    return false;
  }
  if (hasText(personal.tag)) {
    return false;
  }
  if (hasPersonalScalars(personal)) {
    return false;
  }
  if (!isEmptyAddress(personal.postalAddress)) {
    return false;
  }
  if (hasCustomEntries(personal.custom)) {
    return false;
  }
  return true;
}

function isEmptyGroupItem(item: Record<string, unknown>): boolean {
  if (hasText(item.tag)) {
    return false;
  }
  if (hasCustomEntries(item.custom)) {
    return false;
  }
  for (const [key, val] of Object.entries(item)) {
    if (key === "groupId" || key === "tag" || key === "custom") {
      continue;
    }
    if (
      key.endsWith("PostalAddress") ||
      key === "postalAddress" ||
      key === "workPostalAddress" ||
      key === "businessPostalAddress"
    ) {
      if (!isEmptyAddress(val)) {
        return false;
      }
      continue;
    }
    if (val !== undefined && val !== null && hasText(safeString(val))) {
      return false;
    }
  }
  return true;
}

function filterNonEmptyGroupItems<T extends object>(
  items: T[] | undefined,
): T[] | undefined {
  if (!Array.isArray(items)) {
    return undefined;
  }
  const filtered = items.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      !isEmptyGroupItem(item as Record<string, unknown>),
  );
  return filtered.length > 0 ? filtered : undefined;
}

function isEmptyFinancial(financial: ProfileMePatchDto["financial"]): boolean {
  if (!financial) {
    return true;
  }
  const banks = financial.bankAccounts?.length ?? 0;
  const wallets = financial.digitalWallets?.length ?? 0;
  const crypto = financial.cryptoWallets?.length ?? 0;
  return banks === 0 && wallets === 0 && crypto === 0;
}

/** Strip empty shells so PATCH/onboarding do not reconcile-delete or create junk groups. */
export function sanitizeProfilePayload(
  dto: ProfileMePatchDto,
): ProfileMePatchDto {
  const out: ProfileMePatchDto = {};

  if (dto.identity !== undefined) {
    out.identity = dto.identity;
  }

  if (dto.personal !== undefined && dto.personal !== null) {
    const personal = dto.personal as Record<string, unknown>;
    if (!isEmptyPersonal(personal)) {
      out.personal = dto.personal;
    }
  }

  const work = filterNonEmptyGroupItems(dto.work);
  if (work) {
    out.work = work;
  }

  const business = filterNonEmptyGroupItems(dto.business);
  if (business) {
    out.business = business;
  }

  const socials = filterNonEmptyGroupItems(dto.socials);
  if (socials) {
    out.socials = socials;
  }

  if (
    dto.financial !== undefined &&
    dto.financial !== null &&
    !isEmptyFinancial(dto.financial)
  ) {
    out.financial = dto.financial;
  }

  return out;
}
