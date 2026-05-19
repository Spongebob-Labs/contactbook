import { Injectable } from "@nestjs/common";
import type {
  Contact,
  ContactAddress,
  ContactEmail,
  ContactOrganization,
  ContactPhone,
  ContactUrl,
} from "@prisma/client";
import type { ContactDetailDto, ContactSummaryDto } from "./dto/contact-response.dto";

export type ContactWithRelations = Contact & {
  phones: ContactPhone[];
  emails: ContactEmail[];
  organizations: ContactOrganization[];
  addresses: ContactAddress[];
  urls: ContactUrl[];
};

@Injectable()
export class ContactSerializer {
  toSummary(row: ContactWithRelations): ContactSummaryDto {
    const primaryPhone =
      row.phones.find((p) => p.isPrimary) ?? row.phones[0] ?? null;
    const primaryEmail =
      row.emails.find((e) => e.isPrimary) ?? row.emails[0] ?? null;

    return {
      id: row.id,
      source: row.source,
      externalId: row.externalId,
      displayName: row.displayName,
      firstName: row.firstName,
      lastName: row.lastName,
      primaryPhone: primaryPhone
        ? {
            value: primaryPhone.value,
            label: primaryPhone.label,
            isPrimary: primaryPhone.isPrimary,
          }
        : null,
      primaryEmail: primaryEmail
        ? {
            value: primaryEmail.value,
            label: primaryEmail.label,
            isPrimary: primaryEmail.isPrimary,
          }
        : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  toDetail(row: ContactWithRelations): ContactDetailDto {
    return {
      ...this.toSummary(row),
      sourceRevision: row.sourceRevision,
      middleName: row.middleName,
      nickname: row.nickname,
      notes: row.notes,
      phones: row.phones.map((p) => ({
        value: p.value,
        label: p.label,
        isPrimary: p.isPrimary,
      })),
      emails: row.emails.map((e) => ({
        value: e.value,
        label: e.label,
        isPrimary: e.isPrimary,
      })),
      organizations: row.organizations.map((o) => ({
        companyName: o.companyName,
        department: o.department,
        title: o.title,
        isPrimary: o.isPrimary,
      })),
      addresses: row.addresses.map((a) => ({
        street: a.street,
        city: a.city,
        region: a.region,
        postalCode: a.postalCode,
        country: a.country,
        label: a.label,
        isPrimary: a.isPrimary,
      })),
      urls: row.urls.map((u) => ({
        value: u.value,
        label: u.label,
      })),
      deletedAt: row.deletedAt,
    };
  }
}
