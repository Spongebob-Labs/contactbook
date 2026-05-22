import { randomUUID } from "node:crypto";
import type { ContactSource, Prisma } from "@prisma/client";
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

export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

export function buildDedupKeys(contact: NormalizedContact): DedupKey[] {
  const keys = new Map<string, DedupKey>();
  for (const email of contact.emails) {
    const value = normalizeEmail(email.value);
    if (value) {
      keys.set(`email:${value}`, { kind: "email", value });
    }
  }
  for (const phone of contact.phones) {
    const value = normalizePhone(phone.value);
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
): MergeGroupResolution {
  const identity = contactIdentity(contact.source, contact.externalId);
  const keys = buildDedupKeys(contact);

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
