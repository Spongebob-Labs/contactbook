import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { NormalizedContact } from "./normalized-contact.types";
import {
  buildDedupKeys as buildContactDedupKeys,
  flushDedupIndexPending,
  loadDedupIndex,
  normalizeEmail,
  normalizePhone,
  resolveMergeGroupFromIndex,
  type DedupIndex,
  type DedupKey,
  type MergeGroupResolution,
} from "./contact-dedup-index";

export {
  buildContactDedupKeys as buildDedupKeys,
  normalizeEmail,
  normalizePhone,
  type DedupIndex,
  type DedupKey,
  type MergeGroupResolution,
};

@Injectable()
export class ContactDedupService {
  constructor(private readonly prisma: PrismaService) {}

  loadDedupIndex(userId: string) {
    return loadDedupIndex(userId, this.prisma);
  }

  resolveMergeGroupFromIndex(
    index: DedupIndex,
    contact: NormalizedContact,
  ): MergeGroupResolution {
    return resolveMergeGroupFromIndex(index, contact);
  }

  flushDedupIndexPending(
    userId: string,
    index: DedupIndex,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    return flushDedupIndexPending(userId, index, tx);
  }

  buildDedupKeys(contact: NormalizedContact): DedupKey[] {
    return buildContactDedupKeys(contact);
  }

  async resolveMergeGroup(
    userId: string,
    contact: NormalizedContact,
    tx?: Prisma.TransactionClient,
  ): Promise<MergeGroupResolution> {
    const db = tx ?? this.prisma;
    const keys = buildContactDedupKeys(contact);
    if (keys.length === 0) {
      const group = await db.contactMergeGroup.create({
        data: { userId },
      });
      return { mergeGroupId: group.id, duplicateFound: false };
    }

    const existingKeys = await db.contactDedupKey.findMany({
      where: {
        userId,
        OR: keys.map((k) => ({ kind: k.kind, value: k.value })),
      },
      select: { mergeGroupId: true },
      take: 1,
    });

    if (existingKeys.length > 0) {
      const mergeGroupId = existingKeys[0].mergeGroupId;
      const duplicateFound =
        (await db.contact.count({
          where: {
            mergeGroupId,
            deletedAt: null,
            NOT: {
              source: contact.source,
              externalId: contact.externalId,
            },
          },
        })) > 0;
      await this.ensureKeysForGroup(db, userId, mergeGroupId, keys);
      return { mergeGroupId, duplicateFound };
    }

    const group = await db.contactMergeGroup.create({
      data: {
        userId,
        dedupKeys: {
          create: keys.map((k) => ({
            userId,
            kind: k.kind,
            value: k.value,
          })),
        },
      },
    });
    return { mergeGroupId: group.id, duplicateFound: false };
  }

  async refreshKeysForContact(
    userId: string,
    _contactId: string,
    mergeGroupId: string,
    contact: NormalizedContact,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const keys = buildContactDedupKeys(contact);
    const nextSet = new Set(keys.map((k) => `${k.kind}:${k.value}`));
    const owned = await tx.contactDedupKey.findMany({
      where: { mergeGroupId, userId },
      select: { id: true, kind: true, value: true },
    });
    const staleIds = owned
      .filter((row) => !nextSet.has(`${row.kind}:${row.value}`))
      .map((row) => row.id);
    if (staleIds.length > 0) {
      await tx.contactDedupKey.deleteMany({
        where: { id: { in: staleIds } },
      });
    }
    await this.ensureKeysForGroup(tx, userId, mergeGroupId, keys);
  }

  private async ensureKeysForGroup(
    db: Prisma.TransactionClient | PrismaService,
    userId: string,
    mergeGroupId: string,
    keys: DedupKey[],
  ): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    await Promise.all(
      keys.map((key) =>
        db.contactDedupKey.upsert({
          where: {
            userId_kind_value: {
              userId,
              kind: key.kind,
              value: key.value,
            },
          },
          create: {
            userId,
            mergeGroupId,
            kind: key.kind,
            value: key.value,
          },
          update: { mergeGroupId },
        }),
      ),
    );
  }
}
