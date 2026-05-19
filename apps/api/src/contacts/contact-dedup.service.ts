import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { NormalizedContact } from "./normalized-contact.types";

export type DedupKey = { kind: "email" | "phone"; value: string };

export type MergeGroupResolution = {
  mergeGroupId: string;
  duplicateFound: boolean;
};

@Injectable()
export class ContactDedupService {
  constructor(private readonly prisma: PrismaService) {}

  buildDedupKeys(contact: NormalizedContact): DedupKey[] {
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

  async resolveMergeGroup(
    userId: string,
    contact: NormalizedContact,
    tx?: Prisma.TransactionClient,
  ): Promise<MergeGroupResolution> {
    const db = tx ?? this.prisma;
    const keys = this.buildDedupKeys(contact);
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
    const keys = this.buildDedupKeys(contact);
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

export function normalizeEmail(value: string): string | null {
  const t = value.trim().toLowerCase();
  return t.length > 0 && t.includes("@") ? t : null;
}

export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}
