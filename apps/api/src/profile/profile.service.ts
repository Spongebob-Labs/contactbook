import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { FieldCategory, FieldType, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { ApiError } from '../common/errors/api-error';
import {
  decryptFieldValue,
  encryptFieldValue,
  isFinancialFieldType,
} from '../crypto/field-encryption.util';
import { ProfilePhotoStorageService } from './profile-photo-storage.service';
import type { CreateProfileFieldDto } from './dto/create-profile-field.dto';
import type { UpdateProfileFieldDto } from './dto/update-profile-field.dto';
import type { ProfileFieldResponseDto } from './dto/profile-field-response.dto';

const DECRYPTION_FAILED_PLACEHOLDER = '[decryption failed — contact support]';

/**
 * Every query here is scoped by userId at the DATABASE level — `findFirst({
 * where: { id, userId } })`, never `findUnique({ where: { id } })` followed by
 * an application-level ownership check. The latter pattern is exactly how
 * IDOR bugs happen: a query that CAN return another user's row, gated only by
 * an `if` that a future refactor might delete without anyone noticing.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly photoStorage: ProfilePhotoStorageService,
    private readonly logger: AppLogger,
  ) {}

  async list(
    userId: string,
    opts: { category?: FieldCategory; includeArchived?: boolean },
  ) {
    const rows = await this.prisma.profileField.findMany({
      where: {
        userId,
        archivedAt: opts.includeArchived ? undefined : null,
        category: opts.category,
      },
      orderBy: { position: 'asc' },
    });
    return rows.map((row) => this.toResponseDto(userId, row));
  }

  async getOne(userId: string, id: string): Promise<ProfileFieldResponseDto> {
    const row = await this.prisma.profileField.findFirst({
      where: { id, userId },
    });
    if (!row)
      throw ApiError.notFound(
        'PROFILE_FIELD_NOT_FOUND',
        'No such profile field.',
      );
    return this.toResponseDto(userId, row);
  }

  async create(
    userId: string,
    dto: CreateProfileFieldDto,
  ): Promise<ProfileFieldResponseDto> {
    if (dto.type === FieldType.PHOTO) {
      throw ApiError.conflict(
        'PHOTO_VIA_UPLOAD_ONLY',
        'PHOTO fields cannot be created directly — use POST /profile/photo.',
      );
    }

    const fieldId = randomUUID(); // generated up front: encryption's AAD needs it before the row exists
    const position = dto.position ?? (await this.nextPosition(userId));
    const { value, isEncrypted } = this.prepareValueForWrite(
      userId,
      fieldId,
      dto.type,
      dto.value,
    );

    const row = await this.prisma.profileField.create({
      data: {
        id: fieldId,
        userId,
        category: dto.category,
        type: dto.type,
        label: dto.label,
        value,
        isEncrypted,
        position,
      },
    });

    this.logger.info('profile.field_created', {
      userId,
      fieldId: row.id,
      type: row.type,
    });
    return this.toResponseDto(userId, row);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateProfileFieldDto,
  ): Promise<ProfileFieldResponseDto> {
    const existing = await this.prisma.profileField.findFirst({
      where: { id, userId },
    });
    if (!existing)
      throw ApiError.notFound(
        'PROFILE_FIELD_NOT_FOUND',
        'No such profile field.',
      );

    if (existing.type === FieldType.PHOTO && dto.value !== undefined) {
      throw ApiError.conflict(
        'PHOTO_VIA_UPLOAD_ONLY',
        "A photo field's value can only be changed via POST /profile/photo.",
      );
    }

    const data: Prisma.ProfileFieldUpdateInput = {
      category: dto.category,
      label: dto.label,
      position: dto.position,
    };

    if (dto.value !== undefined) {
      const prepared = this.prepareValueForWrite(
        userId,
        existing.id,
        existing.type,
        dto.value,
      );
      data.value = prepared.value;
      data.isEncrypted = prepared.isEncrypted;
    }

    const row = await this.prisma.profileField.update({
      where: { id: existing.id },
      data,
    });
    this.logger.info('profile.field_updated', { userId, fieldId: id });
    return this.toResponseDto(userId, row);
  }

  /** Soft delete. A PHOTO field's GCS object is also removed (best-effort) —
   *  this is the one path both DELETE /profile/fields/:id and
   *  DELETE /profile/photo funnel through, so there is exactly one place
   *  "archive a field" is implemented. */
  async archive(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.profileField.findFirst({
      where: { id, userId },
    });
    if (!existing)
      throw ApiError.notFound(
        'PROFILE_FIELD_NOT_FOUND',
        'No such profile field.',
      );

    await this.prisma.profileField.update({
      where: { id: existing.id },
      data: { archivedAt: new Date() },
    });

    if (existing.type === FieldType.PHOTO) {
      await this.photoStorage.deleteByUrl(existing.value);
    }

    this.logger.info('profile.field_archived', {
      userId,
      fieldId: id,
      type: existing.type,
    });
  }

  /** All-or-nothing: every id must belong to the caller, or none are
   *  reordered. Partial success would leave the list in a state the client
   *  never asked for. */
  async reorder(userId: string, orderedIds: string[]): Promise<void> {
    const owned = await this.prisma.profileField.findMany({
      where: { id: { in: orderedIds }, userId },
      select: { id: true },
    });

    if (owned.length !== orderedIds.length) {
      throw ApiError.forbidden(
        'PROFILE_FIELD_NOT_OWNED',
        'One or more field ids do not belong to you.',
      );
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.profileField.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );

    this.logger.info('profile.fields_reordered', {
      userId,
      count: orderedIds.length,
    });
  }

  /** Upsert-by-type: a user has at most one active PHOTO field. Replacing an
   *  existing photo deletes the old GCS object once the new one is stored. */
  async upsertPhoto(
    userId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<{ id: string; url: string }> {
    const url = await this.photoStorage.upload(userId, file);

    const existing = await this.prisma.profileField.findFirst({
      where: { userId, type: FieldType.PHOTO, archivedAt: null },
    });

    if (existing) {
      const oldUrl = existing.value;
      const row = await this.prisma.profileField.update({
        where: { id: existing.id },
        data: { value: url },
      });
      await this.photoStorage.deleteByUrl(oldUrl);
      this.logger.info('profile.photo_replaced', { userId, fieldId: row.id });
      return { id: row.id, url: row.value };
    }

    const row = await this.prisma.profileField.create({
      data: {
        userId,
        category: 'IDENTITY',
        type: FieldType.PHOTO,
        label: 'Profile photo',
        value: url,
        position: await this.nextPosition(userId),
      },
    });
    this.logger.info('profile.photo_uploaded', { userId, fieldId: row.id });
    return { id: row.id, url: row.value };
  }

  async removePhoto(userId: string): Promise<void> {
    const existing = await this.prisma.profileField.findFirst({
      where: { userId, type: FieldType.PHOTO, archivedAt: null },
    });
    if (!existing)
      throw ApiError.notFound('PHOTO_NOT_FOUND', 'No profile photo to remove.');
    await this.archive(userId, existing.id);
  }

  private async nextPosition(userId: string): Promise<number> {
    const last = await this.prisma.profileField.findFirst({
      where: { userId, archivedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private prepareValueForWrite(
    userId: string,
    fieldId: string,
    type: string,
    plaintext: string,
  ): { value: string; isEncrypted: boolean } {
    if (!isFinancialFieldType(type))
      return { value: plaintext, isEncrypted: false };

    const key = this.config.fieldEncryptionKey;
    if (!key) {
      throw ApiError.conflict(
        'FIELD_ENCRYPTION_NOT_CONFIGURED',
        'Financial field types require FIELD_ENCRYPTION_KEY to be configured.',
      );
    }
    const value = encryptFieldValue(key, { userId, fieldId, type }, plaintext);
    return { value, isEncrypted: true };
  }

  /** Builds the response DTO EXPLICITLY, field by field — never spreads the
   *  raw Prisma row. Nest's ValidationPipe whitelists incoming request
   *  bodies, but nothing strips outgoing ones; a spread here would leak
   *  `userId`, `archivedAt`, and `isEncrypted` straight into the JSON
   *  response with no warning at compile time or runtime. */
  private toResponseDto(
    userId: string,
    row: {
      id: string;
      category: string;
      type: string;
      label: string;
      value: string;
      isEncrypted: boolean;
      position: number;
      createdAt: Date;
      updatedAt: Date;
    },
  ): ProfileFieldResponseDto {
    let value = row.value;

    if (row.isEncrypted) {
      const key = this.config.fieldEncryptionKey;
      try {
        if (!key) throw new Error('FIELD_ENCRYPTION_KEY not configured');
        value = decryptFieldValue(
          key,
          { userId, fieldId: row.id, type: row.type },
          row.value,
        );
      } catch (err) {
        // Never let one corrupted/unrotated row 500 the whole profile list.
        this.logger.error('profile.field_decryption_failed', {
          userId,
          fieldId: row.id,
          err: err instanceof Error ? err.message : String(err),
        });
        value = DECRYPTION_FAILED_PLACEHOLDER;
      }
    }

    return {
      id: row.id,
      category: row.category,
      type: row.type,
      label: row.label,
      value,
      position: row.position,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as ProfileFieldResponseDto;
  }
}
