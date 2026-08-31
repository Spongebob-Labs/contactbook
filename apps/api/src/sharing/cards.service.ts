import { Injectable } from '@nestjs/common';
import {
  Card,
  CardField,
  FieldType,
  Prisma,
  ProfileField,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { ApiError } from '../common/errors/api-error';
import { decryptFieldValueForRead } from '../profile/profile-field-value.util';
import { OutboxService } from '../outbox/outbox.service';
import { TaskEnqueuer } from '../outbox/task-enqueuer';
import { generateShareToken } from './share-token.util';
import {
  diffCardFields,
  isDiffEmpty,
  type CardFieldSnapshotEntry,
} from './card-version-diff.util';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { SetCardFieldsDto } from './dto/set-card-fields.dto';
import { CardResponseDto } from './dto/card-response.dto';
import { AudienceResponseDto } from './dto/audience-response.dto';
import { NotifyCardDto } from './dto/notify-card.dto';
import { NotifyResultDto } from './dto/notify-result.dto';

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
    private readonly outbox: OutboxService,
    private readonly enqueuer: TaskEnqueuer,
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
   *
   * This is also the one place a CardVersion gets written. The appearance
   * PATCH (update(), above) never bumps a version — a palette swap isn't
   * content a recipient can perceive as "the card changed," and bumping
   * currentVersion there would train owners to ignore the "N recipients are
   * behind" signal a notify feature reads off of it.
   */
  async setFields(
    userId: string,
    cardId: string,
    dto: SetCardFieldsDto,
  ): Promise<CardResponseDto> {
    const card = await this.findOwned(userId, cardId);

    const fieldIds = dto.fields.map((f) => f.fieldId);
    const uniqueIds = new Set(fieldIds);
    if (uniqueIds.size !== fieldIds.length) {
      throw ApiError.conflict(
        'DUPLICATE_FIELD_IN_CARD',
        'The same field id was listed more than once.',
      );
    }

    let ownedById = new Map<string, { type: FieldType; label: string }>();
    if (fieldIds.length > 0) {
      const owned = await this.prisma.profileField.findMany({
        where: { id: { in: fieldIds }, userId, archivedAt: null },
        select: { id: true, type: true, label: true },
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
      ownedById = new Map(owned.map((f) => [f.id, f]));
    }

    // Diffed against the CardField rows as they stand right now, before the
    // rewrite below — there is no separate "version 0" snapshot; a card that
    // has never had fields set simply diffs against an empty set. See
    // card-version-diff.util.ts.
    const previousSnapshot: CardFieldSnapshotEntry[] = card.fields.map(
      (cf) => ({
        fieldId: cf.fieldId,
        label: cf.labelOverride ?? cf.field.label,
        type: cf.field.type,
        visible: cf.visible,
        position: cf.position,
      }),
    );
    const nextSnapshot: CardFieldSnapshotEntry[] = dto.fields.map(
      (f, position) => {
        const owned = ownedById.get(f.fieldId)!;
        return {
          fieldId: f.fieldId,
          label: f.labelOverride ?? owned.label,
          type: owned.type,
          visible: f.visible ?? true,
          position,
        };
      },
    );
    const diff = diffCardFields(previousSnapshot, nextSnapshot);
    const hasChanges = !isDiffEmpty(diff);
    const nextVersion = card.currentVersion + 1;

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
        data: {
          updatedAt: new Date(),
          ...(hasChanges && { currentVersion: nextVersion }),
        },
      }),
      // Only written when something actually changed — resubmitting an
      // unchanged selection (a common "save" pattern in a picker UI) must
      // not inflate every recipient's "versions behind" count for nothing.
      ...(hasChanges
        ? [
            this.prisma.cardVersion.create({
              data: {
                cardId,
                version: nextVersion,
                snapshot: nextSnapshot as unknown as Prisma.InputJsonValue,
                diff: diff as unknown as Prisma.InputJsonValue,
              },
            }),
          ]
        : []),
    ]);

    const row = await this.prisma.card.findUniqueOrThrow({
      where: { id: cardId },
      include: CARD_WITH_FIELDS_INCLUDE,
    });
    return this.toResponseDto(userId, row);
  }

  /**
   * Active recipients and how far behind each one is. Deliberately excludes
   * an aggregated field-level diff across versions ("changedSince") — that's
   * a future in-app diff view; the WhatsApp message this drives toward is
   * generic on purpose (see notify() below), so the count is all this needs
   * to answer today.
   */
  async getAudience(
    userId: string,
    cardId: string,
  ): Promise<AudienceResponseDto> {
    const card = await this.findOwned(userId, cardId);

    const links = await this.prisma.shareLink.findMany({
      where: { cardId, status: 'ACTIVE' },
      include: { contact: { select: { phoneE164: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      currentVersion: card.currentVersion,
      recipients: links.map((link) => ({
        shareLinkId: link.id,
        contactId: link.contactId,
        contactDisplayName: link.contact.displayName,
        contactPhoneE164: link.contact.phoneE164,
        lastNotifiedVersion: link.lastNotifiedVersion,
        versionsBehind: card.currentVersion - (link.lastNotifiedVersion ?? 0),
        viewCount: link.viewCount,
        lastViewedAt: link.lastViewedAt,
      })),
    };
  }

  /**
   * Sends a generic "this card was updated" WhatsApp notice to chosen active
   * recipients — no field-level diff in the message (a product decision, not
   * a limitation: CardVersion.diff exists for a future in-app view, not for
   * the WhatsApp text). One recipient at a time, mirroring
   * ShareLinksService.share()'s transaction pattern exactly: the outbox
   * write happens in the same transaction as nothing else changes here (the
   * ShareLink row itself isn't touched until the send actually succeeds —
   * see the send_whatsapp_card_update handler in sharing.module.ts, which
   * bumps lastNotifiedVersion only on confirmed send).
   *
   * dedupeKey is deterministic (card_update:<linkId>:<version>), unlike
   * share()'s uuid-suffixed key — re-triggering notify for the same
   * recipient about the same version is a true no-op; a further edit bumps
   * the version and produces a fresh key.
   *
   * Fans out to N outbox rows, not N synchronous Twilio calls — the actual
   * throttle toward Twilio is the messages-outbound Cloud Tasks queue
   * (10/s, 20 concurrent, declared in iac/modules/queues, not in app code),
   * so this scales the same way a large share() fan-out would.
   */
  async notify(
    userId: string,
    cardId: string,
    dto: NotifyCardDto,
  ): Promise<NotifyResultDto[]> {
    const card = await this.findOwned(userId, cardId);

    const links = await this.prisma.shareLink.findMany({
      where: { id: { in: dto.shareLinkIds }, cardId, status: 'ACTIVE' },
      include: { contact: { select: { phoneE164: true } } },
    });
    if (links.length !== dto.shareLinkIds.length) {
      throw ApiError.notFound(
        'SHARE_LINK_NOT_FOUND',
        'One or more ids are not active links on this card.',
      );
    }

    const owner = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const ownerName =
      [owner.firstName, owner.lastName].filter(Boolean).join(' ') || 'Someone';

    const results: NotifyResultDto[] = [];
    for (const link of links) {
      const dedupeKey = `card_update:${link.id}:${card.currentVersion}`;
      let outboxId: string;
      let alreadyEnqueued = false;
      try {
        outboxId = await this.prisma.$transaction(async (tx) => {
          const row = await this.outbox.enqueue(tx, {
            dedupeKey,
            kind: 'send_whatsapp_card_update',
            payload: {
              shareLinkId: link.id,
              contactPhoneE164: link.contact.phoneE164,
              ownerName,
              shareToken: link.token,
              notifyVersion: card.currentVersion,
            },
          });
          return row.id;
        });
      } catch (err) {
        // The deterministic dedupeKey (unlike share()'s uuid-suffixed one) is
        // what makes double-clicking "notify" for the same recipient about
        // the same version a true no-op rather than a duplicate send — a
        // P2002 here means it was already enqueued, not a real failure.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          const existing = await this.prisma.outboxMessage.findUniqueOrThrow({
            where: { dedupeKey },
          });
          outboxId = existing.id;
          alreadyEnqueued = true;
        } else {
          throw err;
        }
      }

      if (!alreadyEnqueued) {
        this.enqueuer.enqueue(outboxId, 'outbound');
        this.logger.info('sharing.card_update_notify_enqueued', {
          shareLinkId: link.id,
          cardId,
          notifyVersion: card.currentVersion,
        });
      }
      results.push({
        shareLinkId: link.id,
        outboxMessageId: outboxId,
        status: 'ENQUEUED',
      });
    }

    return results;
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
