import { Injectable } from "@nestjs/common";
import type { ContactSource, Prisma } from "@prisma/client";
import type { DedupIndex } from "./contact-dedup-index";
import { ContactDedupService } from "./contact-dedup.service";
import {
  contactRowToNormalized,
  mergeNormalizedContactFields,
  mergeScalarFields,
} from "./contact-merge.util";
import { ContactProviderLinkService } from "./contact-provider-link.service";
import {
  emptyContactSyncStats,
  importSyncOutcome,
  incrementSyncStat,
  type ContactSyncStats,
} from "./contact-sync-stats";
import { PrismaService } from "../prisma/prisma.service";
import type { NormalizedContact } from "./normalized-contact.types";
import {
  CONTACT_BATCH_TRANSACTION_TIMEOUT_MS,
  VCF_IMPORT_BATCH_SIZE,
} from "./vcard-import.constants";
import type {
  ContactSoftDeleteResult,
  ContactUpsertResult,
} from "./contact-upsert.types";

/** Large imports run many dedup queries per contact; default 5s Prisma tx timeout is too low. */
const CONTACT_UPSERT_TRANSACTION_TIMEOUT_MS = 60_000;
const CONTACT_UPSERT_TRANSACTION_MAX_WAIT_MS = 10_000;

const contactChildrenInclude = {
  phones: { orderBy: { sortOrder: "asc" as const } },
  emails: { orderBy: { sortOrder: "asc" as const } },
  organizations: { orderBy: { sortOrder: "asc" as const } },
  addresses: { orderBy: { sortOrder: "asc" as const } },
  urls: { orderBy: { sortOrder: "asc" as const } },
};

export type UpsertBatchOptions = {
  batchSize?: number;
  /** User dial prefix (e.g. +91) for phone dedup normalization. */
  defaultRegion?: string;
};

type PlannedContactRow = {
  contact: NormalizedContact;
  mergeGroupId: string;
  duplicateFound: boolean;
  targetContactId?: string;
  isNewContact: boolean;
  crossSourceMerge: boolean;
};

@Injectable()
export class ContactUpsertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dedup: ContactDedupService,
    private readonly providerLinks: ContactProviderLinkService,
  ) {}

  async upsert(
    userId: string,
    contact: NormalizedContact,
    options?: Pick<UpsertBatchOptions, "defaultRegion">,
  ): Promise<ContactUpsertResult | ContactSoftDeleteResult | null> {
    if (contact.deleted) {
      return this.softDelete(userId, contact.source, contact.externalId);
    }

    const defaultRegion =
      options?.defaultRegion ?? (await this.getUserDefaultRegion(userId));

    return this.prisma.$transaction(
      async (tx) => {
        const outcome = await this.applyUpsertInTransaction(
          userId,
          contact,
          defaultRegion,
          tx,
        );
        return outcome;
      },
      {
        timeout: CONTACT_UPSERT_TRANSACTION_TIMEOUT_MS,
        maxWait: CONTACT_UPSERT_TRANSACTION_MAX_WAIT_MS,
      },
    );
  }

  async softDelete(
    userId: string,
    source: ContactSource,
    externalId: string,
  ): Promise<ContactSoftDeleteResult> {
    const deleted = await this.providerLinks.softDeleteByProviderKey(
      userId,
      source,
      externalId,
    );
    if (!deleted) {
      await this.prisma.contact.updateMany({
        where: { userId, source, externalId },
        data: { deletedAt: new Date() },
      });
    }
    return { outcome: "deleted", duplicateFound: false };
  }

  async countActive(userId: string, source?: ContactSource): Promise<number> {
    return this.prisma.contact.count({
      where: {
        userId,
        deletedAt: null,
        ...(source ? { source } : {}),
      },
    });
  }

  /** Batched import path for large VCF uploads and provider bulk syncs (Google). */
  async upsertBatch(
    userId: string,
    contacts: NormalizedContact[],
    options?: UpsertBatchOptions,
  ): Promise<ContactSyncStats> {
    const stats = emptyContactSyncStats();
    if (contacts.length === 0) {
      return stats;
    }

    const defaultRegion =
      options?.defaultRegion ?? (await this.getUserDefaultRegion(userId));
    const batchSize = options?.batchSize ?? VCF_IMPORT_BATCH_SIZE;
    const index = await this.dedup.loadDedupIndex(userId);

    for (let offset = 0; offset < contacts.length; offset += batchSize) {
      const chunk = contacts.slice(offset, offset + batchSize);
      await this.prisma.$transaction(
        async (tx) => {
          await this.upsertBatchChunk(
            userId,
            chunk,
            index,
            stats,
            defaultRegion,
            tx,
          );
        },
        {
          timeout: CONTACT_BATCH_TRANSACTION_TIMEOUT_MS,
          maxWait: CONTACT_UPSERT_TRANSACTION_MAX_WAIT_MS,
        },
      );
    }

    return stats;
  }

  private async getUserDefaultRegion(
    userId: string,
  ): Promise<string | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { countryCode: true },
    });
    return user?.countryCode ?? undefined;
  }

  private async applyUpsertInTransaction(
    userId: string,
    contact: NormalizedContact,
    defaultRegion: string | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<ContactUpsertResult> {
    const resolvedId = await this.providerLinks.resolveContactId(
      userId,
      contact.source,
      contact.externalId,
      tx,
    );

    const { mergeGroupId, duplicateFound } = await this.dedup.resolveMergeGroup(
      userId,
      contact,
      tx,
      defaultRegion,
    );

    if (resolvedId) {
      return this.updateExistingContact(
        userId,
        resolvedId,
        contact,
        mergeGroupId,
        duplicateFound,
        false,
        defaultRegion,
        tx,
      );
    }

    if (duplicateFound) {
      const primaryId =
        await this.providerLinks.findPrimaryContactIdInMergeGroup(
          userId,
          mergeGroupId,
          tx,
        );
      if (primaryId) {
        return this.updateExistingContact(
          userId,
          primaryId,
          contact,
          mergeGroupId,
          true,
          true,
          defaultRegion,
          tx,
        );
      }
    }

    const row = await tx.contact.create({
      data: {
        ...this.contactScalarFields(contact),
        mergeGroupId,
        userId,
      },
    });

    await this.providerLinks.upsertLink(userId, row.id, contact, true, tx);
    await this.dedup.refreshKeysForContact(
      userId,
      row.id,
      mergeGroupId,
      contact,
      tx,
      defaultRegion,
    );
    await this.replaceChildren(tx, row.id, contact);

    return { contact: row, outcome: "added", duplicateFound };
  }

  private async updateExistingContact(
    userId: string,
    contactId: string,
    contact: NormalizedContact,
    mergeGroupId: string,
    duplicateFound: boolean,
    crossSourceMerge: boolean,
    defaultRegion: string | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<ContactUpsertResult> {
    const existingRow = await tx.contact.findUniqueOrThrow({
      where: { id: contactId },
      include: contactChildrenInclude,
    });
    const hadActiveExisting = existingRow.deletedAt == null;
    const sameProviderKey =
      existingRow.source === contact.source &&
      existingRow.externalId === contact.externalId;
    const shouldUnionMerge =
      crossSourceMerge || (duplicateFound && !sameProviderKey);

    const mergedContact = shouldUnionMerge
      ? mergeNormalizedContactFields(
          contactRowToNormalized(existingRow),
          contact,
          defaultRegion,
        )
      : contact;

    const row = await tx.contact.update({
      where: { id: contactId },
      data: {
        ...(shouldUnionMerge
          ? mergeScalarFields(existingRow, contact)
          : this.contactDataFields(contact)),
        mergeGroupId,
        deletedAt: null,
      },
    });

    const isPrimaryLink = !crossSourceMerge && sameProviderKey;

    await this.providerLinks.upsertLink(
      userId,
      contactId,
      contact,
      isPrimaryLink,
      tx,
    );

    await this.dedup.refreshKeysForContact(
      userId,
      contactId,
      mergeGroupId,
      mergedContact,
      tx,
      defaultRegion,
    );
    await this.replaceChildren(tx, contactId, mergedContact);

    if (shouldUnionMerge) {
      await this.softDeleteSiblings(userId, contactId, mergeGroupId, tx);
    }

    const outcome = importSyncOutcome(
      hadActiveExisting || crossSourceMerge,
      duplicateFound || crossSourceMerge,
    );
    return {
      contact: row,
      outcome,
      duplicateFound: duplicateFound || crossSourceMerge,
    };
  }

  private async softDeleteSiblings(
    userId: string,
    primaryId: string,
    mergeGroupId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.contact.updateMany({
      where: {
        userId,
        mergeGroupId,
        id: { not: primaryId },
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
  }

  private async upsertBatchChunk(
    userId: string,
    chunk: NormalizedContact[],
    index: DedupIndex,
    stats: ContactSyncStats,
    defaultRegion: string | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const active: NormalizedContact[] = [];
    const toDelete: NormalizedContact[] = [];
    for (const contact of chunk) {
      if (contact.deleted) {
        toDelete.push(contact);
      } else {
        active.push(contact);
      }
    }

    for (const contact of toDelete) {
      const deleted = await this.providerLinks.softDeleteByProviderKey(
        userId,
        contact.source,
        contact.externalId,
        tx,
      );
      if (!deleted) {
        await tx.contact.updateMany({
          where: {
            userId,
            source: contact.source,
            externalId: contact.externalId,
          },
          data: { deletedAt: new Date() },
        });
      }
      incrementSyncStat(stats, "deleted");
    }

    if (active.length === 0) {
      return;
    }

    const source = active[0].source;
    const externalIds = active.map((c) => c.externalId);

    const [existingRows, linkRows] = await Promise.all([
      tx.contact.findMany({
        where: { userId, source, externalId: { in: externalIds } },
        select: { id: true, externalId: true, deletedAt: true },
      }),
      tx.contactProviderLink.findMany({
        where: { userId, source, externalId: { in: externalIds } },
        select: {
          externalId: true,
          contactId: true,
          contact: { select: { deletedAt: true } },
        },
      }),
    ]);

    const resolvedByExternalId = new Map<string, string>();
    for (const row of existingRows) {
      if (row.deletedAt == null) {
        resolvedByExternalId.set(row.externalId, row.id);
      }
    }
    for (const link of linkRows) {
      if (
        link.contact.deletedAt == null &&
        !resolvedByExternalId.has(link.externalId)
      ) {
        resolvedByExternalId.set(link.externalId, link.contactId);
      }
    }

    const planned: PlannedContactRow[] = [];
    const mergeGroupIds: string[] = [];

    for (const contact of active) {
      const resolvedId = resolvedByExternalId.get(contact.externalId);
      const { mergeGroupId, duplicateFound } =
        this.dedup.resolveMergeGroupFromIndex(index, contact, defaultRegion);

      if (resolvedId) {
        planned.push({
          contact,
          mergeGroupId,
          duplicateFound,
          targetContactId: resolvedId,
          isNewContact: false,
          crossSourceMerge: false,
        });
        continue;
      }

      if (duplicateFound) {
        mergeGroupIds.push(mergeGroupId);
        planned.push({
          contact,
          mergeGroupId,
          duplicateFound: true,
          isNewContact: false,
          crossSourceMerge: true,
        });
        continue;
      }

      planned.push({
        contact,
        mergeGroupId,
        duplicateFound: false,
        isNewContact: true,
        crossSourceMerge: false,
      });
    }

    const primaryByMergeGroup =
      await this.providerLinks.findPrimaryContactIdsForMergeGroups(
        userId,
        mergeGroupIds,
        tx,
      );

    for (const row of planned) {
      if (row.crossSourceMerge && !row.targetContactId) {
        row.targetContactId =
          primaryByMergeGroup.get(row.mergeGroupId) ?? undefined;
      }
    }

    await this.dedup.flushDedupIndexPending(userId, index, tx);

    const pendingPrimaryByMergeGroup = new Map<string, string>();

    for (const row of planned) {
      if (row.isNewContact) {
        const created = await tx.contact.create({
          data: {
            ...this.contactScalarFields(row.contact),
            mergeGroupId: row.mergeGroupId,
            userId,
          },
        });
        pendingPrimaryByMergeGroup.set(row.mergeGroupId, created.id);
        await this.providerLinks.upsertLink(
          userId,
          created.id,
          row.contact,
          true,
          tx,
        );
        await this.dedup.refreshKeysForContact(
          userId,
          created.id,
          row.mergeGroupId,
          row.contact,
          tx,
          defaultRegion,
        );
        await this.replaceChildren(tx, created.id, row.contact);
        incrementSyncStat(
          stats,
          importSyncOutcome(false, row.duplicateFound),
          row.duplicateFound,
        );
        continue;
      }

      const targetId =
        row.targetContactId ?? pendingPrimaryByMergeGroup.get(row.mergeGroupId);
      if (!targetId) {
        continue;
      }

      await this.updateExistingContact(
        userId,
        targetId,
        row.contact,
        row.mergeGroupId,
        row.duplicateFound,
        row.crossSourceMerge,
        defaultRegion,
        tx,
      );
      incrementSyncStat(
        stats,
        importSyncOutcome(true, row.duplicateFound || row.crossSourceMerge),
        row.duplicateFound || row.crossSourceMerge,
      );
    }
  }

  private contactDataFields(contact: NormalizedContact) {
    return {
      sourceRevision: contact.sourceRevision ?? null,
      displayName: contact.displayName ?? null,
      firstName: contact.firstName ?? null,
      lastName: contact.lastName ?? null,
      middleName: contact.middleName ?? null,
      namePrefix: contact.namePrefix ?? null,
      nameSuffix: contact.nameSuffix ?? null,
      nickname: contact.nickname ?? null,
      notes: contact.notes ?? null,
    };
  }

  private contactScalarFields(contact: NormalizedContact) {
    return {
      source: contact.source,
      externalId: contact.externalId,
      ...this.contactDataFields(contact),
    };
  }

  private async replaceChildren(
    tx: Prisma.TransactionClient,
    contactId: string,
    contact: NormalizedContact,
  ): Promise<void> {
    await tx.contactPhone.deleteMany({ where: { contactId } });
    await tx.contactEmail.deleteMany({ where: { contactId } });
    await tx.contactOrganization.deleteMany({ where: { contactId } });
    await tx.contactAddress.deleteMany({ where: { contactId } });
    await tx.contactUrl.deleteMany({ where: { contactId } });

    if (contact.phones.length > 0) {
      await tx.contactPhone.createMany({
        data: contact.phones.map((p, sortOrder) => ({
          contactId,
          value: p.value,
          label: p.label ?? null,
          isPrimary: p.isPrimary ?? false,
          sortOrder,
        })),
      });
    }
    if (contact.emails.length > 0) {
      await tx.contactEmail.createMany({
        data: contact.emails.map((e, sortOrder) => ({
          contactId,
          value: e.value,
          label: e.label ?? null,
          isPrimary: e.isPrimary ?? false,
          sortOrder,
        })),
      });
    }
    if (contact.organizations.length > 0) {
      await tx.contactOrganization.createMany({
        data: contact.organizations.map((o, sortOrder) => ({
          contactId,
          companyName: o.companyName ?? null,
          department: o.department ?? null,
          title: o.title ?? null,
          isPrimary: o.isPrimary ?? false,
          sortOrder,
        })),
      });
    }
    if (contact.addresses.length > 0) {
      await tx.contactAddress.createMany({
        data: contact.addresses.map((a, sortOrder) => ({
          contactId,
          street: a.street ?? null,
          city: a.city ?? null,
          region: a.region ?? null,
          postalCode: a.postalCode ?? null,
          country: a.country ?? null,
          label: a.label ?? null,
          isPrimary: a.isPrimary ?? false,
          sortOrder,
        })),
      });
    }
    if (contact.urls.length > 0) {
      await tx.contactUrl.createMany({
        data: contact.urls.map((u, sortOrder) => ({
          contactId,
          value: u.value,
          label: u.label ?? null,
          sortOrder,
        })),
      });
    }
  }
}
