import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  FieldCategory,
  FieldGroupCategory,
  FieldType,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { ApiError } from '../common/errors/api-error';
import { isFinancialFieldType } from '../crypto/field-encryption.util';
import {
  decryptFieldValueForRead,
  prepareFieldValueForWrite,
} from './profile-field-value.util';
import { ProfilePhotoStorageService } from './profile-photo-storage.service';
import type { CreateProfileFieldDto } from './dto/create-profile-field.dto';
import type { UpdateProfileFieldDto } from './dto/update-profile-field.dto';
import type { ProfileFieldResponseDto } from './dto/profile-field-response.dto';
import type { CreateProfileFieldGroupDto } from './dto/create-profile-field-group.dto';
import type { UpdateProfileFieldGroupDto } from './dto/update-profile-field-group.dto';
import type { ProfileFieldGroupResponseDto } from './dto/profile-field-group-response.dto';

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

  // ---------------------------------------------------------------- fields

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
    if (dto.type === FieldType.COMPANY_LOGO) {
      throw ApiError.conflict(
        'COMPANY_LOGO_VIA_UPLOAD_ONLY',
        'COMPANY_LOGO fields cannot be created directly — use POST /profile/company-logo.',
      );
    }

    if (dto.groupId) {
      await this.assertGroupOwnership(userId, dto.groupId);
    }

    const fieldId = randomUUID(); // generated up front: encryption's AAD needs it before the row exists
    const position = dto.position ?? (await this.nextPosition(userId));
    const { value, isEncrypted } = prepareFieldValueForWrite(
      this.config.fieldEncryptionKey,
      { userId, fieldId, type: dto.type },
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
        groupId: dto.groupId,
      },
    });

    this.logger.info('profile.field_created', {
      userId,
      fieldId: row.id,
      type: row.type,
      groupId: row.groupId,
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

    if (
      (existing.type === FieldType.PHOTO ||
        existing.type === FieldType.COMPANY_LOGO) &&
      dto.value !== undefined
    ) {
      throw ApiError.conflict(
        'PHOTO_VIA_UPLOAD_ONLY',
        "This field's value can only be changed via its dedicated upload endpoint.",
      );
    }

    const data: Prisma.ProfileFieldUpdateInput = {
      category: dto.category,
      label: dto.label,
      position: dto.position,
    };

    // What a recipient can actually perceive changing. Financial values are
    // masked on the public page, so editing one is invisible to them and must
    // not make anyone "behind"; a label edit is visible for every type.
    let perceivable = dto.label !== undefined && dto.label !== existing.label;

    if (dto.value !== undefined) {
      const prepared = prepareFieldValueForWrite(
        this.config.fieldEncryptionKey,
        { userId, fieldId: existing.id, type: existing.type },
        dto.value,
      );
      data.value = prepared.value;
      data.isEncrypted = prepared.isEncrypted;
      if (
        !isFinancialFieldType(existing.type) &&
        prepared.value !== existing.value
      ) {
        perceivable = true;
      }
    }

    // One transaction: the edit and the version bump land together or not at
    // all, so a recipient can never be "behind" on a change that didn't save.
    const [row] = await this.prisma.$transaction([
      this.prisma.profileField.update({ where: { id: existing.id }, data }),
      ...(perceivable ? [this.bumpCardsShowing(userId, existing.id)] : []),
    ]);
    this.logger.info('profile.field_updated', {
      userId,
      fieldId: id,
      cardsVersionBumped: perceivable,
    });
    return this.toResponseDto(userId, row);
  }

  /**
   * Bumps `Card.currentVersion` on every live card of this owner that shows
   * the field, which is what makes "N recipients are behind" true after a
   * profile edit.
   *
   * Before this, only `PUT /cards/:id/fields` (the selection changing) moved
   * the version. Editing a phone number's *value* changed what every
   * recipient sees through their link while `versionsBehind` stayed 0, and
   * `notify` dedupes on `(shareLink, currentVersion)`: the owner pressing
   * Send would have been a silent no-op.
   *
   * Counter only, no `CardVersion` row: that table is a selection-change
   * audit (field ids, labels, never values) and nothing reads it.
   */
  private bumpCardsShowing(userId: string, fieldId: string) {
    return this.prisma.card.updateMany({
      where: {
        userId,
        archivedAt: null,
        fields: { some: { fieldId, visible: true } },
      },
      data: { currentVersion: { increment: 1 } },
    });
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

    // Archiving removes the field from every card that showed it, which is a
    // change recipients can see. Bump before it leaves, in the same transaction.
    await this.prisma.$transaction([
      this.bumpCardsShowing(userId, existing.id),
      this.prisma.profileField.update({
        where: { id: existing.id },
        data: { archivedAt: new Date() },
      }),
    ]);

    if (
      existing.type === FieldType.PHOTO ||
      existing.type === FieldType.COMPANY_LOGO
    ) {
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

  // ----------------------------------------------------------------- photo

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

  /** Upsert-by-type: a user has at most one active COMPANY_LOGO field. Replacing
   *  an existing logo deletes the old GCS object once the new one is stored. */
  async upsertCompanyLogo(
    userId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<{ id: string; url: string }> {
    const url = await this.photoStorage.upload(userId, file);

    const existing = await this.prisma.profileField.findFirst({
      where: { userId, type: FieldType.COMPANY_LOGO, archivedAt: null },
    });

    if (existing) {
      const oldUrl = existing.value;
      const row = await this.prisma.profileField.update({
        where: { id: existing.id },
        data: { value: url },
      });
      await this.photoStorage.deleteByUrl(oldUrl);
      this.logger.info('profile.company_logo_replaced', {
        userId,
        fieldId: row.id,
      });
      return { id: row.id, url: row.value };
    }

    const row = await this.prisma.profileField.create({
      data: {
        userId,
        category: 'WORK',
        type: FieldType.COMPANY_LOGO,
        label: 'Company logo',
        value: url,
        position: await this.nextPosition(userId),
      },
    });
    this.logger.info('profile.company_logo_uploaded', {
      userId,
      fieldId: row.id,
    });
    return { id: row.id, url: row.value };
  }

  async removeCompanyLogo(userId: string): Promise<void> {
    const existing = await this.prisma.profileField.findFirst({
      where: { userId, type: FieldType.COMPANY_LOGO, archivedAt: null },
    });
    if (!existing)
      throw ApiError.notFound(
        'COMPANY_LOGO_NOT_FOUND',
        'No company logo to remove.',
      );
    await this.archive(userId, existing.id);
  }

  // ----------------------------------------------------------------- groups

  async listGroups(
    userId: string,
    opts: { category?: FieldGroupCategory; includeArchived?: boolean },
  ): Promise<ProfileFieldGroupResponseDto[]> {
    const groups = await this.prisma.profileFieldGroup.findMany({
      where: {
        userId,
        archivedAt: opts.includeArchived ? undefined : null,
        category: opts.category,
      },
      orderBy: { position: 'asc' },
      include: {
        fields: {
          where: { archivedAt: opts.includeArchived ? undefined : null },
          orderBy: { position: 'asc' },
        },
      },
    });
    return groups.map((g) => this.toGroupResponseDto(userId, g));
  }

  async createGroup(
    userId: string,
    dto: CreateProfileFieldGroupDto,
  ): Promise<ProfileFieldGroupResponseDto> {
    const position = await this.nextGroupPosition(userId);
    const group = await this.prisma.profileFieldGroup.create({
      data: { userId, category: dto.category, tag: dto.tag, position },
      include: { fields: true },
    });
    this.logger.info('profile.group_created', {
      userId,
      groupId: group.id,
      category: group.category,
    });
    return this.toGroupResponseDto(userId, group);
  }

  async updateGroup(
    userId: string,
    id: string,
    dto: UpdateProfileFieldGroupDto,
  ): Promise<ProfileFieldGroupResponseDto> {
    await this.assertGroupOwnership(userId, id);
    const group = await this.prisma.profileFieldGroup.update({
      where: { id },
      data: { category: dto.category, tag: dto.tag },
      include: {
        fields: { where: { archivedAt: null }, orderBy: { position: 'asc' } },
      },
    });
    this.logger.info('profile.group_updated', { userId, groupId: id });
    return this.toGroupResponseDto(userId, group);
  }

  /** Archives the group AND every one of its currently-active fields, in one
   *  transaction. The schema's onDelete: Cascade on ProfileField.groupId only
   *  fires on a real row deletion — since groups are soft-deleted like
   *  everything else here, the field-level archive has to be done explicitly,
   *  or a user could "remove" a job and still have its phone/email show up as
   *  loose, ungrouped fields on their live profile. */
  async archiveGroup(userId: string, id: string): Promise<void> {
    const group = await this.assertGroupOwnership(userId, id);

    const photoFields = await this.prisma.profileField.findMany({
      where: { groupId: id, type: FieldType.PHOTO, archivedAt: null },
    });

    await this.prisma.$transaction([
      this.prisma.profileFieldGroup.update({
        where: { id },
        data: { archivedAt: new Date() },
      }),
      this.prisma.profileField.updateMany({
        where: { groupId: id, archivedAt: null },
        data: { archivedAt: new Date() },
      }),
    ]);

    // Best-effort, outside the transaction: GCS is not transactional with
    // Postgres, so this can only ever be "delete after the DB commit succeeds".
    for (const photo of photoFields) {
      await this.photoStorage.deleteByUrl(photo.value);
    }

    this.logger.info('profile.group_archived', {
      userId,
      groupId: id,
      category: group.category,
    });
  }

  /** Throws PROFILE_FIELD_GROUP_NOT_FOUND if the group does not exist or
   *  belongs to someone else — the two cases are deliberately indistinguishable
   *  to the caller, same reasoning as every other ownership check here. */
  private async assertGroupOwnership(userId: string, groupId: string) {
    const group = await this.prisma.profileFieldGroup.findFirst({
      where: { id: groupId, userId },
    });
    if (!group) {
      throw ApiError.notFound(
        'PROFILE_FIELD_GROUP_NOT_FOUND',
        'No such profile field group.',
      );
    }
    return group;
  }

  private async nextGroupPosition(userId: string): Promise<number> {
    const last = await this.prisma.profileFieldGroup.findFirst({
      where: { userId, archivedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private toGroupResponseDto(
    userId: string,
    group: {
      id: string;
      category: string;
      tag: string | null;
      position: number;
      fields: Parameters<ProfileService['toResponseDto']>[1][];
    },
  ): ProfileFieldGroupResponseDto {
    return {
      id: group.id,
      category: group.category,
      tag: group.tag,
      position: group.position,
      fields: group.fields.map((f) => this.toResponseDto(userId, f)),
    } as ProfileFieldGroupResponseDto;
  }

  // ---------------------------------------------------------------- shared

  private async nextPosition(userId: string): Promise<number> {
    const last = await this.prisma.profileField.findFirst({
      where: { userId, archivedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
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
      groupId: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
  ): ProfileFieldResponseDto {
    const value = decryptFieldValueForRead(
      this.config.fieldEncryptionKey,
      { userId, fieldId: row.id, type: row.type },
      row.value,
      row.isEncrypted,
      (err) =>
        this.logger.error('profile.field_decryption_failed', {
          userId,
          fieldId: row.id,
          err: err instanceof Error ? err.message : String(err),
        }),
    );

    return {
      id: row.id,
      category: row.category,
      type: row.type,
      label: row.label,
      value,
      position: row.position,
      groupId: row.groupId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as ProfileFieldResponseDto;
  }
}
