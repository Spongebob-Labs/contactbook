import { Injectable } from '@nestjs/common';
import { Card, CardField, FieldType, ProfileField } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { ApiError } from '../common/errors/api-error';
import { decryptFieldValueForRead } from '../profile/profile-field-value.util';
import { generateShareToken } from './share-token.util';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { SetCardFieldsDto } from './dto/set-card-fields.dto';
import { CardResponseDto } from './dto/card-response.dto';

type CardWithFields = Card & {
  fields: (CardField & { field: ProfileField })[];
};

const CARD_WITH_FIELDS_INCLUDE = {
  fields: {
    orderBy: { position: 'asc' as const },
    include: { field: true },
  },
};

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {}

  async list(
    userId: string,
    includeArchived = false,
  ): Promise<CardResponseDto[]> {
    const rows = await this.prisma.card.findMany({
      where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: { createdAt: 'desc' },
      include: CARD_WITH_FIELDS_INCLUDE,
    });
    return rows.map((r) => this.toResponseDto(userId, r));
  }

  async getOne(userId: string, id: string): Promise<CardResponseDto> {
    const row = await this.findOwned(userId, id);
    return this.toResponseDto(userId, row);
  }

  async create(userId: string, dto: CreateCardDto): Promise<CardResponseDto> {
    const row = await this.prisma.card.create({
      data: {
        userId,
        name: dto.name,
        kind: dto.kind,
        // The card's own public URL, independent of any recipient — never
        // client-suppliable (no field on CreateCardDto for it) and immutable
        // for the card's life; update() below deliberately cannot touch it.
        publicToken: generateShareToken(),
        templateId: dto.templateId,
        paletteId: dto.paletteId,
        groundHex: dto.groundHex,
        finish: dto.finish,
        texture: dto.texture,
        texturePresence: dto.texturePresence,
        textureScale: dto.textureScale,
      },
      include: CARD_WITH_FIELDS_INCLUDE,
    });
    return this.toResponseDto(userId, row);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCardDto,
  ): Promise<CardResponseDto> {
    await this.findOwned(userId, id);
    const row = await this.prisma.card.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.kind !== undefined && { kind: dto.kind }),
        ...(dto.templateId !== undefined && { templateId: dto.templateId }),
        ...(dto.paletteId !== undefined && { paletteId: dto.paletteId }),
        ...(dto.groundHex !== undefined && { groundHex: dto.groundHex }),
        ...(dto.finish !== undefined && { finish: dto.finish }),
        ...(dto.texture !== undefined && { texture: dto.texture }),
        ...(dto.texturePresence !== undefined && {
          texturePresence: dto.texturePresence,
        }),
        ...(dto.textureScale !== undefined && {
          textureScale: dto.textureScale,
        }),
      },
      include: CARD_WITH_FIELDS_INCLUDE,
    });
    return this.toResponseDto(userId, row);
  }

  /**
   * Archiving a card also revokes every ShareLink pointing at it, in the
   * same transaction — an owner deleting a card expects it gone for
   * recipients too, not silently still resolvable because the ShareLink row
   * itself is untouched. ShareLinksService.resolvePublic also checks
   * card.archivedAt independently as a defense-in-depth backstop, so this
   * cascade being the primary mechanism (not the only possible one) is fine.
   */
  async archive(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.prisma.$transaction([
      this.prisma.card.update({
        where: { id },
        data: { archivedAt: new Date() },
      }),
      this.prisma.shareLink.updateMany({
        where: { cardId: id, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      }),
    ]);
  }

  /**
   * Replaces the card's entire curated field set — this is a picker UI
   * submitting "here's my current selection," not an incremental add/remove.
   * All-or-nothing: every fieldId must resolve to one of the caller's own,
   * non-archived, non-PHOTO ProfileFields, or nothing is changed.
   */
  async setFields(
    userId: string,
    cardId: string,
    dto: SetCardFieldsDto,
  ): Promise<CardResponseDto> {
    await this.findOwned(userId, cardId);

    const fieldIds = dto.fields.map((f) => f.fieldId);
    const uniqueIds = new Set(fieldIds);
    if (uniqueIds.size !== fieldIds.length) {
      throw ApiError.conflict(
        'DUPLICATE_FIELD_IN_CARD',
        'The same field id was listed more than once.',
      );
    }

    if (fieldIds.length > 0) {
      const owned = await this.prisma.profileField.findMany({
        where: { id: { in: fieldIds }, userId, archivedAt: null },
        select: { id: true, type: true },
      });
      if (owned.length !== fieldIds.length) {
        throw ApiError.notFound(
          'PROFILE_FIELD_NOT_FOUND',
          'One or more field ids do not belong to you or do not exist.',
        );
      }
      const photoField = owned.find((f) => f.type === FieldType.PHOTO);
      if (photoField) {
        throw ApiError.conflict(
          'PHOTO_NOT_A_CARD_FIELD',
          'A profile photo is shown on every card automatically — it cannot be added as a regular field.',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.cardField.deleteMany({ where: { cardId } }),
      ...dto.fields.map((f, position) =>
        this.prisma.cardField.create({
          data: {
            cardId,
            fieldId: f.fieldId,
            visible: f.visible ?? true,
            position,
            labelOverride: f.labelOverride,
          },
        }),
      ),
      // Bumps Card.updatedAt explicitly — verified live that Prisma's
      // @updatedAt auto-bump does NOT fire on an empty `data: {}` update
      // (nothing to generate a SET clause from, so the row is untouched).
      // The public payload reports this as "when the field selection last
      // changed," which otherwise only CardField rows would reflect.
      this.prisma.card.update({
        where: { id: cardId },
        data: { updatedAt: new Date() },
      }),
    ]);

    const row = await this.prisma.card.findUniqueOrThrow({
      where: { id: cardId },
      include: CARD_WITH_FIELDS_INCLUDE,
    });
    return this.toResponseDto(userId, row);
  }

  /** IDOR guard: every read/write resolves through this, never a bare findUnique. */
  async findOwned(userId: string, id: string): Promise<CardWithFields> {
    const row = await this.prisma.card.findFirst({
      where: { id, userId },
      include: CARD_WITH_FIELDS_INCLUDE,
    });
    if (!row) {
      throw ApiError.notFound('CARD_NOT_FOUND', 'No card with that id.');
    }
    return row;
  }

  private toResponseDto(userId: string, card: CardWithFields): CardResponseDto {
    return {
      id: card.id,
      name: card.name,
      kind: card.kind,
      // Always the full URL, never the bare token — the frontend must never
      // be the thing that knows how to assemble a public URL, that is how
      // the two sides drift (see the now-dead `/c/{slug}` guess this
      // replaces). Same construction ShareLinksService.buildUrl() uses.
      publicUrl: `${this.config.shareBaseUrl.replace(/\/+$/, '')}/c/${card.publicToken}`,
      templateId: card.templateId,
      paletteId: card.paletteId,
      groundHex: card.groundHex,
      finish: card.finish,
      texture: card.texture,
      texturePresence: card.texturePresence,
      textureScale: card.textureScale,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      fields: card.fields.map((cf) => ({
        fieldId: cf.fieldId,
        category: cf.field.category,
        type: cf.field.type,
        label: cf.labelOverride ?? cf.field.label,
        value: decryptFieldValueForRead(
          this.config.fieldEncryptionKey,
          { userId, fieldId: cf.field.id, type: cf.field.type },
          cf.field.value,
          cf.field.isEncrypted,
          (err) =>
            this.logger.error('sharing.field_decryption_failed', {
              userId,
              fieldId: cf.field.id,
              err: err instanceof Error ? err.message : String(err),
            }),
        ),
        visible: cf.visible,
        position: cf.position,
      })),
    };
  }
}
