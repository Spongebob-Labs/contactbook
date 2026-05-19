import { Injectable } from "@nestjs/common";
import type { Contact, ContactSource, Prisma } from "@prisma/client";
import { ContactDedupService } from "./contact-dedup.service";
import { PrismaService } from "../prisma/prisma.service";
import type { NormalizedContact } from "./normalized-contact.types";
import type {
  ContactSoftDeleteResult,
  ContactUpsertResult,
} from "./contact-upsert.types";

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

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.contact.findUnique({
        where: {
          userId_source_externalId: {
            userId,
            source: contact.source,
            externalId: contact.externalId,
          },
        },
      });

      const { mergeGroupId, duplicateFound } = await this.dedup.resolveMergeGroup(
        userId,
        contact,
        tx,
      );

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

      const outcome = existing ? "updated" : "added";
      return { contact: row, outcome, duplicateFound };
    });
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
