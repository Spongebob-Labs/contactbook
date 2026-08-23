import { Injectable } from '@nestjs/common';
import { Recipient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../common/errors/api-error';
import { UpsertRecipientDto } from './dto/upsert-recipient.dto';
import { UpdateRecipientDto } from './dto/update-recipient.dto';
import { RecipientResponseDto } from './dto/recipient-response.dto';

@Injectable()
export class RecipientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string): Promise<RecipientResponseDto[]> {
    const rows = await this.prisma.recipient.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toResponseDto(r));
  }

  async getOne(ownerId: string, id: string): Promise<RecipientResponseDto> {
    const row = await this.findOwned(ownerId, id);
    return this.toResponseDto(row);
  }

  /**
   * The core primitive: "make sure this phone number is in my recipient
   * registry, with this display name/notes if it's new." Used both by
   * POST /recipients directly and internally by SharingService when minting
   * a share link — a recipient doesn't have to be added as a separate step
   * before you can share with them.
   *
   * Deliberately an upsert, not create-or-409: Recipient isn't a
   * created-once resource the way a Card is, it's "make sure this contact
   * exists," so calling it again for the same number updates the name/notes
   * rather than erroring.
   */
  async upsertByPhone(
    ownerId: string,
    dto: UpsertRecipientDto,
  ): Promise<RecipientResponseDto> {
    const row = await this.prisma.recipient.upsert({
      where: { ownerId_phoneE164: { ownerId, phoneE164: dto.phoneE164 } },
      create: {
        ownerId,
        phoneE164: dto.phoneE164,
        displayName: dto.displayName,
        notes: dto.notes,
      },
      update: {
        // Only overwrite fields actually sent — re-sharing with just a phone
        // number shouldn't blank out a display name set earlier.
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
    return this.toResponseDto(row);
  }

  async update(
    ownerId: string,
    id: string,
    dto: UpdateRecipientDto,
  ): Promise<RecipientResponseDto> {
    await this.findOwned(ownerId, id);
    const row = await this.prisma.recipient.update({
      where: { id },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
    return this.toResponseDto(row);
  }

  /** IDOR guard: every read/write resolves through this, never a bare findUnique. */
  private async findOwned(ownerId: string, id: string): Promise<Recipient> {
    const row = await this.prisma.recipient.findFirst({
      where: { id, ownerId },
    });
    if (!row) {
      throw ApiError.notFound(
        'RECIPIENT_NOT_FOUND',
        'No recipient with that id.',
      );
    }
    return row;
  }

  private toResponseDto(row: Recipient): RecipientResponseDto {
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
