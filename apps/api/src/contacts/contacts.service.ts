import { Injectable } from '@nestjs/common';
import { Contact } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../common/errors/api-error';
import { UpsertContactDto } from './dto/upsert-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ImportContactsDto } from './dto/import-contacts.dto';
import { ContactResponseDto } from './dto/contact-response.dto';
import { ImportContactsResponseDto } from './dto/import-contacts-response.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string): Promise<ContactResponseDto[]> {
    const rows = await this.prisma.contact.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toResponseDto(r));
  }

  async getOne(ownerId: string, id: string): Promise<ContactResponseDto> {
    const row = await this.findOwned(ownerId, id);
    return this.toResponseDto(row);
  }

  /**
   * The core primitive: "make sure this phone number is in my contact
   * registry, with this display name/notes if it's new." Deliberately an
   * upsert, not create-or-409 — Contact isn't a created-once resource the
   * way a Card is, it's "make sure this contact exists."
   */
  async upsertByPhone(
    ownerId: string,
    dto: UpsertContactDto,
  ): Promise<ContactResponseDto> {
    const row = await this.prisma.contact.upsert({
      where: { ownerId_phoneE164: { ownerId, phoneE164: dto.phoneE164 } },
      create: {
        ownerId,
        phoneE164: dto.phoneE164,
        displayName: dto.displayName,
        notes: dto.notes,
        source: 'MANUAL',
      },
      update: {
        // Only overwrite fields actually sent.
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
    return this.toResponseDto(row);
  }

  /**
   * Bulk add — the actual expected onboarding path for contacts, e.g. after
   * the FE reads the device address book. Upserts each entry the same way
   * upsertByPhone does, tagging newly-created rows `source: IMPORTED` so
   * they're distinguishable from a one-at-a-time POST /contacts add. A
   * phone already in the registry has its displayName refreshed but keeps
   * its original `source` — re-importing doesn't rewrite how a contact was
   * first added.
   */
  async import(
    ownerId: string,
    dto: ImportContactsDto,
  ): Promise<ImportContactsResponseDto> {
    // Last entry wins for a phone number repeated within the same batch —
    // a client sending duplicates is a client bug, not something to 409 on.
    const byPhone = new Map(dto.contacts.map((c) => [c.phoneE164, c]));

    const existing = await this.prisma.contact.findMany({
      where: { ownerId, phoneE164: { in: [...byPhone.keys()] } },
      select: { phoneE164: true },
    });
    const existingPhones = new Set(existing.map((e) => e.phoneE164));

    const rows = await this.prisma.$transaction(
      [...byPhone.values()].map((c) =>
        this.prisma.contact.upsert({
          where: { ownerId_phoneE164: { ownerId, phoneE164: c.phoneE164 } },
          create: {
            ownerId,
            phoneE164: c.phoneE164,
            displayName: c.displayName,
            source: 'IMPORTED',
          },
          update: {
            ...(c.displayName !== undefined && { displayName: c.displayName }),
          },
        }),
      ),
    );

    const created: ContactResponseDto[] = [];
    const updated: ContactResponseDto[] = [];
    for (const row of rows) {
      (existingPhones.has(row.phoneE164) ? updated : created).push(
        this.toResponseDto(row),
      );
    }
    return { created, updated };
  }

  async update(
    ownerId: string,
    id: string,
    dto: UpdateContactDto,
  ): Promise<ContactResponseDto> {
    await this.findOwned(ownerId, id);
    const row = await this.prisma.contact.update({
      where: { id },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
    return this.toResponseDto(row);
  }

  /** IDOR guard: every read/write resolves through this, never a bare findUnique. */
  async findOwned(ownerId: string, id: string): Promise<Contact> {
    const row = await this.prisma.contact.findFirst({
      where: { id, ownerId },
    });
    if (!row) {
      throw ApiError.notFound('CONTACT_NOT_FOUND', 'No contact with that id.');
    }
    return row;
  }

  private toResponseDto(row: Contact): ContactResponseDto {
    return {
      id: row.id,
      phoneE164: row.phoneE164,
      displayName: row.displayName,
      notes: row.notes,
      source: row.source,
      optedOutAt: row.optedOutAt,
      createdAt: row.createdAt,
    };
  }
}
