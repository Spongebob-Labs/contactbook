import { Injectable } from "@nestjs/common";
import type { Contact, ContactSource, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { NormalizedContact } from "./normalized-contact.types";

@Injectable()
export class ContactUpsertService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    userId: string,
    contact: NormalizedContact,
  ): Promise<Contact | null> {
    if (contact.deleted) {
      await this.softDelete(userId, contact.source, contact.externalId);
      return null;
    }

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.contact.upsert({
        where: {
          userId_source_externalId: {
            userId,
            source: contact.source,
            externalId: contact.externalId,
          },
        },
        create: this.contactCreateData(userId, contact),
        update: {
          ...this.contactScalarFields(contact),
          deletedAt: null,
        },
      });

      await this.replaceChildren(tx, row.id, contact);
      return row;
    });
  }

  async softDelete(
    userId: string,
    source: ContactSource,
    externalId: string,
  ): Promise<void> {
    await this.prisma.contact.updateMany({
      where: { userId, source, externalId },
      data: { deletedAt: new Date() },
    });
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

  private contactCreateData(
    userId: string,
    contact: NormalizedContact,
  ): Prisma.ContactCreateInput {
    return {
      ...this.contactScalarFields(contact),
      user: { connect: { id: userId } },
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
