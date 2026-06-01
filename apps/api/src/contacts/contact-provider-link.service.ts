import { Injectable } from "@nestjs/common";
import type { ContactSource, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { NormalizedContact } from "./normalized-contact.types";

type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ContactProviderLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveContactId(
    userId: string,
    source: ContactSource,
    externalId: string,
    db: DbClient = this.prisma,
  ): Promise<string | null> {
    const direct = await db.contact.findUnique({
      where: {
        userId_source_externalId: { userId, source, externalId },
      },
      select: { id: true, deletedAt: true },
    });
    if (direct && direct.deletedAt == null) {
      return direct.id;
    }

    const link = await db.contactProviderLink.findUnique({
      where: {
        userId_source_externalId: { userId, source, externalId },
      },
      select: {
        contactId: true,
        contact: { select: { deletedAt: true } },
      },
    });
    if (link && link.contact.deletedAt == null) {
      return link.contactId;
    }
    return null;
  }

  async findPrimaryContactIdInMergeGroup(
    userId: string,
    mergeGroupId: string,
    db: DbClient = this.prisma,
  ): Promise<string | null> {
    const primary = await db.contact.findFirst({
      where: { userId, mergeGroupId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return primary?.id ?? null;
  }

  async findPrimaryContactIdsForMergeGroups(
    userId: string,
    mergeGroupIds: string[],
    db: DbClient = this.prisma,
  ): Promise<Map<string, string>> {
    const unique = [...new Set(mergeGroupIds.filter(Boolean))];
    if (unique.length === 0) {
      return new Map();
    }
    const rows = await db.contact.findMany({
      where: { userId, mergeGroupId: { in: unique }, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, mergeGroupId: true },
    });
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.mergeGroupId && !map.has(row.mergeGroupId)) {
        map.set(row.mergeGroupId, row.id);
      }
    }
    return map;
  }

  async upsertLink(
    userId: string,
    contactId: string,
    contact: Pick<
      NormalizedContact,
      "source" | "externalId" | "sourceRevision"
    >,
    isPrimary: boolean,
    db: DbClient = this.prisma,
  ): Promise<void> {
    const primarySourceLink = await db.contactProviderLink.findUnique({
      where: {
        contactId_source: { contactId, source: contact.source },
      },
    });

    const byProviderKey = await db.contactProviderLink.findUnique({
      where: {
        userId_source_externalId: {
          userId,
          source: contact.source,
          externalId: contact.externalId,
        },
      },
    });
    if (byProviderKey) {
      if (byProviderKey.contactId === contactId) {
        await db.contactProviderLink.update({
          where: { id: byProviderKey.id },
          data: {
            sourceRevision: contact.sourceRevision ?? null,
            isPrimary,
          },
        });
        return;
      }
      if (primarySourceLink && primarySourceLink.id !== byProviderKey.id) {
        await db.contactProviderLink.delete({
          where: { id: byProviderKey.id },
        });
        if (isPrimary) {
          await db.contactProviderLink.update({
            where: { id: primarySourceLink.id },
            data: {
              sourceRevision: contact.sourceRevision ?? null,
              isPrimary: true,
            },
          });
        }
        return;
      }
      await db.contactProviderLink.update({
        where: { id: byProviderKey.id },
        data: {
          contactId,
          sourceRevision: contact.sourceRevision ?? null,
          isPrimary,
        },
      });
      return;
    }

    if (primarySourceLink) {
      if (isPrimary) {
        await db.contactProviderLink.update({
          where: { id: primarySourceLink.id },
          data: {
            externalId: contact.externalId,
            sourceRevision: contact.sourceRevision ?? null,
            isPrimary: true,
          },
        });
      }
      return;
    }

    await db.contactProviderLink.create({
      data: {
        userId,
        contactId,
        source: contact.source,
        externalId: contact.externalId,
        sourceRevision: contact.sourceRevision ?? null,
        isPrimary,
      },
    });
  }

  async softDeleteByProviderKey(
    userId: string,
    source: ContactSource,
    externalId: string,
    db: DbClient = this.prisma,
  ): Promise<boolean> {
    const contactId = await this.resolveContactId(
      userId,
      source,
      externalId,
      db,
    );
    if (!contactId) {
      return false;
    }
    await db.contact.update({
      where: { id: contactId },
      data: { deletedAt: new Date() },
    });
    return true;
  }
}
