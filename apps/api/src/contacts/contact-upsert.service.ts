import { Injectable } from "@nestjs/common";
import type { ContactSource, Prisma } from "@prisma/client";
import type { DedupIndex } from "./contact-dedup-index";
import { ContactDedupService } from "./contact-dedup.service";
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

export type UpsertBatchOptions = {
  batchSize?: number;
};

type PlannedContactRow = {
  contact: NormalizedContact;
  mergeGroupId: string;
  duplicateFound: boolean;
  existingId?: string;
};

@Injectable()
export class ContactUpsertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dedup: ContactDedupService,
  ) {}

  async upsert(
    userId: string,
    contact: NormalizedContact,
  ): Promise<ContactUpsertResult | ContactSoftDeleteResult | null> {
    if (contact.deleted) {
      return this.softDelete(userId, contact.source, contact.externalId);
    }

    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.contact.findUnique({
          where: {
            userId_source_externalId: {
              userId,
              source: contact.source,
              externalId: contact.externalId,
            },
          },
        });

        const { mergeGroupId, duplicateFound } =
          await this.dedup.resolveMergeGroup(userId, contact, tx);

        const row = await tx.contact.upsert({
          where: {
            userId_source_externalId: {
              userId,
              source: contact.source,
              externalId: contact.externalId,
            },
          },
          create: {
            ...this.contactScalarFields(contact),
            mergeGroupId,
            userId,
          },
          update: {
            ...this.contactScalarFields(contact),
            mergeGroupId,
            deletedAt: null,
          },
        });

        await this.dedup.refreshKeysForContact(
          userId,
          row.id,
          mergeGroupId,
          contact,
          tx,
        );
        await this.replaceChildren(tx, row.id, contact);

        const hasActiveExisting =
          existing != null && existing.deletedAt == null;
        const outcome = importSyncOutcome(hasActiveExisting, duplicateFound);
        return { contact: row, outcome, duplicateFound };
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
    await this.prisma.contact.updateMany({
      where: { userId, source, externalId },
      data: { deletedAt: new Date() },
    });
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

    const batchSize = options?.batchSize ?? VCF_IMPORT_BATCH_SIZE;
    const index = await this.dedup.loadDedupIndex(userId);

    for (let offset = 0; offset < contacts.length; offset += batchSize) {
      const chunk = contacts.slice(offset, offset + batchSize);
      await this.prisma.$transaction(
        async (tx) => {
          await this.upsertBatchChunk(userId, chunk, index, stats, tx);
        },
        {
          timeout: CONTACT_BATCH_TRANSACTION_TIMEOUT_MS,
          maxWait: CONTACT_UPSERT_TRANSACTION_MAX_WAIT_MS,
        },
      );
    }

    return stats;
  }

  private async upsertBatchChunk(
    userId: string,
    chunk: NormalizedContact[],
    index: DedupIndex,
    stats: ContactSyncStats,
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

    if (toDelete.length > 0) {
      await Promise.all(
        toDelete.map((contact) =>
          tx.contact.updateMany({
            where: {
              userId,
              source: contact.source,
              externalId: contact.externalId,
            },
            data: { deletedAt: new Date() },
          }),
        ),
      );
      toDelete.forEach(() => {
        incrementSyncStat(stats, "deleted");
      });
    }

    if (active.length === 0) {
      return;
    }

    const source = active[0].source;
    const externalIds = active.map((c) => c.externalId);
    const existingRows = await tx.contact.findMany({
      where: { userId, source, externalId: { in: externalIds } },
      select: { id: true, externalId: true, deletedAt: true },
    });
    const existingByExternalId = new Map(
      existingRows.map((row) => [row.externalId, row]),
    );

    const planned: PlannedContactRow[] = active.map((contact) => {
      const { mergeGroupId, duplicateFound } =
        this.dedup.resolveMergeGroupFromIndex(index, contact);
      const existing = existingByExternalId.get(contact.externalId);
      const existingId = existing?.id;
      const hasActiveExisting = existing != null && existing.deletedAt == null;
      incrementSyncStat(
        stats,
        importSyncOutcome(hasActiveExisting, duplicateFound),
        duplicateFound,
      );
      return { contact, mergeGroupId, duplicateFound, existingId };
    });

    await this.dedup.flushDedupIndexPending(userId, index, tx);

    const toCreate = planned.filter((row) => !row.existingId);
    const toUpdate = planned.filter((row) => row.existingId);

    const created =
      toCreate.length > 0
        ? await tx.contact.createManyAndReturn({
            data: toCreate.map((row) => ({
              ...this.contactScalarFields(row.contact),
              mergeGroupId: row.mergeGroupId,
              userId,
            })),
          })
        : [];

    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map((row) =>
          tx.contact.update({
            where: { id: row.existingId! },
            data: {
              ...this.contactScalarFields(row.contact),
              mergeGroupId: row.mergeGroupId,
              deletedAt: null,
            },
          }),
        ),
      );
    }

    const contactIds = [
      ...created.map((row) => row.id),
      ...toUpdate.map((row) => row.existingId!),
    ];

    const contactById = new Map<string, NormalizedContact>();
    for (const row of planned) {
      const id =
        row.existingId ??
        created.find((c) => c.externalId === row.contact.externalId)?.id;
      if (id) {
        contactById.set(id, row.contact);
      }
    }

    await this.replaceChildrenBulk(tx, contactIds, contactById);
  }

  private async replaceChildrenBulk(
    tx: Prisma.TransactionClient,
    contactIds: string[],
    contactById: Map<string, NormalizedContact>,
  ): Promise<void> {
    if (contactIds.length === 0) {
      return;
    }

    await tx.contactPhone.deleteMany({
      where: { contactId: { in: contactIds } },
    });
    await tx.contactEmail.deleteMany({
      where: { contactId: { in: contactIds } },
    });
    await tx.contactOrganization.deleteMany({
      where: { contactId: { in: contactIds } },
    });
    await tx.contactAddress.deleteMany({
      where: { contactId: { in: contactIds } },
    });
    await tx.contactUrl.deleteMany({
      where: { contactId: { in: contactIds } },
    });

    const phones: Prisma.ContactPhoneCreateManyInput[] = [];
    const emails: Prisma.ContactEmailCreateManyInput[] = [];
    const organizations: Prisma.ContactOrganizationCreateManyInput[] = [];
    const addresses: Prisma.ContactAddressCreateManyInput[] = [];
    const urls: Prisma.ContactUrlCreateManyInput[] = [];

    for (const [contactId, contact] of contactById) {
      contact.phones.forEach((p, sortOrder) => {
        phones.push({
          contactId,
          value: p.value,
          label: p.label ?? null,
          isPrimary: p.isPrimary ?? false,
          sortOrder,
        });
      });
      contact.emails.forEach((e, sortOrder) => {
        emails.push({
          contactId,
          value: e.value,
          label: e.label ?? null,
          isPrimary: e.isPrimary ?? false,
          sortOrder,
        });
      });
      contact.organizations.forEach((o, sortOrder) => {
        organizations.push({
          contactId,
          companyName: o.companyName ?? null,
          department: o.department ?? null,
          title: o.title ?? null,
          isPrimary: o.isPrimary ?? false,
          sortOrder,
        });
      });
      contact.addresses.forEach((a, sortOrder) => {
        addresses.push({
          contactId,
          street: a.street ?? null,
          city: a.city ?? null,
          region: a.region ?? null,
          postalCode: a.postalCode ?? null,
          country: a.country ?? null,
          label: a.label ?? null,
          isPrimary: a.isPrimary ?? false,
          sortOrder,
        });
      });
      contact.urls.forEach((u, sortOrder) => {
        urls.push({
          contactId,
          value: u.value,
          label: u.label ?? null,
          sortOrder,
        });
      });
    }

    if (phones.length > 0) {
      await tx.contactPhone.createMany({ data: phones });
    }
    if (emails.length > 0) {
      await tx.contactEmail.createMany({ data: emails });
    }
    if (organizations.length > 0) {
      await tx.contactOrganization.createMany({ data: organizations });
    }
    if (addresses.length > 0) {
      await tx.contactAddress.createMany({ data: addresses });
    }
    if (urls.length > 0) {
      await tx.contactUrl.createMany({ data: urls });
    }
  }

  private contactScalarFields(contact: NormalizedContact) {
    return {
      source: contact.source,
      externalId: contact.externalId,
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
