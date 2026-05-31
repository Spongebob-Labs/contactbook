import { randomUUID } from "node:crypto";
import type { ContactSource, Prisma } from "@prisma/client";
import parsePhoneNumberFromString, {
  type CountryCode,
  getCountries,
  getCountryCallingCode,
} from "libphonenumber-js/max";
import { normalizeDialCode } from "../common/phone.util";
import type { PrismaService } from "../prisma/prisma.service";
import type { NormalizedContact } from "./normalized-contact.types";

export type DedupKey = { kind: "email" | "phone"; value: string };

export type MergeGroupResolution = {
  mergeGroupId: string;
  duplicateFound: boolean;
};

export function normalizeEmail(value: string): string | null {
  const t = value.trim().toLowerCase();
  return t.length > 0 && t.includes("@") ? t : null;
}

export function defaultCountryFromDialCode(
  dialCode: string | undefined,
): CountryCode | undefined {
  if (!dialCode?.trim()) {
    return undefined;
  }
  const wanted = normalizeDialCode(dialCode).replace("+", "");
  for (const country of getCountries()) {
    if (getCountryCallingCode(country) === wanted) {
      return country;
    }
  }
  return undefined;
}

export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

export function normalizePhoneForDedup(
  value: string,
  defaultRegion?: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const defaultCountry = defaultCountryFromDialCode(defaultRegion);
  const parsed = parsePhoneNumberFromString(
    trimmed,
    defaultCountry ?? undefined,
  );
  if (parsed?.isValid()) {
    return parsed.number.replace("+", "");
  }
  const digits = normalizePhone(trimmed);
  if (digits) {
    return digits;
  }
  const serviceCode = trimmed.replace(/\s+/g, "");
  if (
    (serviceCode.includes("*") || serviceCode.includes("#")) &&
    /^[*#\d]{3,}$/.test(serviceCode)
  ) {
    return `svc:${serviceCode.toLowerCase()}`;
  }
  const shortDigits = trimmed.replace(/\D/g, "");
  if (shortDigits.length >= 4) {
    return `short:${shortDigits}`;
  }
  return null;
}

export function buildDedupKeys(
  contact: NormalizedContact,
  defaultRegion?: string,
): DedupKey[] {
  const keys = new Map<string, DedupKey>();
  for (const email of contact.emails) {
    const value = normalizeEmail(email.value);
    if (value) {
      keys.set(`email:${value}`, { kind: "email", value });
    }
  }
  for (const phone of contact.phones) {
    const value = normalizePhoneForDedup(phone.value, defaultRegion);
    if (value) {
      keys.set(`phone:${value}`, { kind: "phone", value });
    }
  }
  return [...keys.values()];
}

export function dedupKeyToken(kind: string, value: string): string {
  return `${kind}:${value}`;
}

export function contactIdentity(
  source: ContactSource,
  externalId: string,
): string {
  return `${source}:${externalId}`;
}

export type DedupIndex = {
  keyToMergeGroup: Map<string, string>;
  groupMembers: Map<string, Set<string>>;
  pendingNewGroupIds: Set<string>;
  pendingKeyCreates: Map<
    string,
    { mergeGroupId: string; kind: string; value: string }
  >;
};

export function createEmptyDedupIndex(): DedupIndex {
  return {
    keyToMergeGroup: new Map(),
    groupMembers: new Map(),
    pendingNewGroupIds: new Set(),
    pendingKeyCreates: new Map(),
  };
}

export async function loadDedupIndex(
  userId: string,
  prisma: PrismaService,
): Promise<DedupIndex> {
  const [keys, contacts] = await Promise.all([
    prisma.contactDedupKey.findMany({
      where: { userId },
      select: { kind: true, value: true, mergeGroupId: true },
    }),
    prisma.contact.findMany({
      where: { userId, deletedAt: null, mergeGroupId: { not: null } },
      select: { mergeGroupId: true, source: true, externalId: true },
    }),
  ]);

  const index = createEmptyDedupIndex();
  for (const row of keys) {
    index.keyToMergeGroup.set(
      dedupKeyToken(row.kind, row.value),
      row.mergeGroupId,
    );
  }
  for (const row of contacts) {
    if (!row.mergeGroupId) {
      continue;
    }
    let members = index.groupMembers.get(row.mergeGroupId);
    if (!members) {
      members = new Set();
      index.groupMembers.set(row.mergeGroupId, members);
    }
    members.add(contactIdentity(row.source, row.externalId));
  }
  return index;
}

export function resolveMergeGroupFromIndex(
  index: DedupIndex,
  contact: NormalizedContact,
  defaultRegion?: string,
): MergeGroupResolution {
  const identity = contactIdentity(contact.source, contact.externalId);
  const keys = buildDedupKeys(contact, defaultRegion);

  let mergeGroupId: string | undefined;
  for (const key of keys) {
    const token = dedupKeyToken(key.kind, key.value);
    const existing = index.keyToMergeGroup.get(token);
    if (existing) {
      mergeGroupId = existing;
      break;
    }
  }

  if (!mergeGroupId) {
    mergeGroupId = randomUUID();
    index.pendingNewGroupIds.add(mergeGroupId);
  }

  let members = index.groupMembers.get(mergeGroupId);
  if (!members) {
    members = new Set();
    index.groupMembers.set(mergeGroupId, members);
  }
  const duplicateFound = [...members].some((id) => id !== identity);
  members.add(identity);

  registerKeysOnIndex(index, mergeGroupId, keys);

  return { mergeGroupId, duplicateFound };
}

function registerKeysOnIndex(
  index: DedupIndex,
  mergeGroupId: string,
  keys: DedupKey[],
): void {
  for (const key of keys) {
    const token = dedupKeyToken(key.kind, key.value);
    if (!index.keyToMergeGroup.has(token)) {
      index.pendingKeyCreates.set(token, {
        mergeGroupId,
        kind: key.kind,
        value: key.value,
      });
    }
    index.keyToMergeGroup.set(token, mergeGroupId);
  }
}

export async function flushDedupIndexPending(
  userId: string,
  index: DedupIndex,
  tx: Prisma.TransactionClient,
): Promise<void> {
  if (index.pendingNewGroupIds.size > 0) {
    await tx.contactMergeGroup.createMany({
      data: [...index.pendingNewGroupIds].map((id) => ({ id, userId })),
      skipDuplicates: true,
    });
    index.pendingNewGroupIds.clear();
  }

  if (index.pendingKeyCreates.size > 0) {
    await tx.contactDedupKey.createMany({
      data: [...index.pendingKeyCreates.values()].map((row) => ({
        userId,
        mergeGroupId: row.mergeGroupId,
        kind: row.kind,
        value: row.value,
      })),
      skipDuplicates: true,
    });
    index.pendingKeyCreates.clear();
  }
}
