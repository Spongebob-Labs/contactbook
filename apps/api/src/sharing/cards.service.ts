import { randomUUID } from 'node:crypto';
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
import { CardLogoStorageService } from './card-logo-storage.service';
import { CardCoverStorageService } from './card-cover-storage.service';
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
    private readonly logoStorage: CardLogoStorageService,
    private readonly coverStorage: CardCoverStorageService,
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

  /**
   * `file` is optional and, when present, is a logo to attach in the same
   * call — POST /cards is multipart/form-data specifically to allow this
   * (see cards.controller.ts). Card creation and the logo attach are NOT one
   * DB transaction (the GCS upload can't participate in one) — instead,
   * treated as atomic from the caller's perspective by other means: if
   * attachLogo() fails for any reason (bad mimetype, too large, storage
   * unconfigured, or a genuine GCS-side failure), the just-created card row
   * is deleted before the error propagates. Without this, a failed logo
   * would leave an orphaned, logo-less card silently existing in the
   * caller's account while they only ever see an error response — worse
   * than either succeeding cleanly or not existing at all.
   */
  async create(
    userId: string,
    dto: CreateCardDto,
    file?: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<CardResponseDto> {
    // Validate fieldIds up front, before opening any transaction, so we fail
    // fast and cleanly without a half-created card to clean up.
    if (dto.fieldIds && dto.fieldIds.length > 0) {
      const owned = await this.prisma.profileField.findMany({
        where: { id: { in: dto.fieldIds }, userId, archivedAt: null },
        select: { id: true, type: true },
      });
      if (owned.length !== dto.fieldIds.length) {
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

    const cardId = randomUUID();
    const cardData = {
      id: cardId,
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
      headline: dto.headline,
      bio: dto.bio,
    };

    let row: Card & { fields: (CardField & { field: ProfileField })[] };

    if (dto.fieldIds && dto.fieldIds.length > 0) {
      // Card creation + field attachment in a single transaction so a network
      // failure between them can never leave an empty card in the database.
      // cardId is generated before the transaction so CardField rows can
      // reference it without waiting for the INSERT to return.
      await this.prisma.$transaction([
        this.prisma.card.create({ data: cardData }),
        ...dto.fieldIds.map((fieldId, position) =>
          this.prisma.cardField.create({
            data: { cardId, fieldId, visible: true, position },
          }),
        ),
      ]);
      // Re-fetch with the full include so toResponseDto has all the joined data.
      row = await this.prisma.card.findUniqueOrThrow({
        where: { id: cardId },
        include: CARD_WITH_FIELDS_INCLUDE,
      });
    } else {
      row = await this.prisma.card.create({
        data: cardData,
        include: CARD_WITH_FIELDS_INCLUDE,
      });
    }

    if (!file) {
      return this.toResponseDto(userId, row);
    }

    try {
      const withLogo = await this.attachLogo(row.id, null, file);
      this.logger.info('sharing.card_logo_uploaded', {
        userId,
        cardId: row.id,
      });
      return this.toResponseDto(userId, withLogo);
    } catch (err) {
      await this.prisma.card.delete({ where: { id: row.id } });
      throw err;
    }
  }

  /**
   * `null` vs omitted is load-bearing on every nullable field below: the
   * conditional spread includes a key whenever the DTO value is
   * `!== undefined` — which is true for both a real value AND an explicit
   * `null`, and false only when the field was left out of the request body
   * entirely. Prisma then either sets the column or clears it to NULL,
   * exactly matching "null clears it, omitted leaves it alone."
   *
   * `coverUrl` is the one field where clearing has a side effect: an
   * explicit `null` (the DTO only ever allows null or omitted — see
   * UpdateCardDto) also deletes the GCS object, same as removeLogo()/
   * removeCover() do, so a cleared card doesn't leave storage tracking a
   * URL nothing points at anymore.
   */
  async update(
    userId: string,
    id: string,
    dto: UpdateCardDto,
  ): Promise<CardResponseDto> {
    const existing = await this.findOwned(userId, id);

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.card.update({
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
          ...(dto.headline !== undefined && { headline: dto.headline }),
          ...(dto.bio !== undefined && { bio: dto.bio }),
          // dto.coverUrl, when present at all, is always exactly null (the
          // DTO rejects anything else) — this is a clear, never a set.
          ...(dto.coverUrl !== undefined && { coverUrl: null }),
        },
        include: CARD_WITH_FIELDS_INCLUDE,
      });

      // Enqueue wallet push in the same transaction so it cannot be lost if
      // the card update commits but the push never fires.
      await this.outbox.enqueue(tx, {
        dedupeKey: `wallet-push:${id}:${updated.updatedAt.getTime()}`,
        kind: 'wallet_push',
        payload: { cardId: id },
      });

      return updated;
    });

    if (dto.coverUrl === null && existing.coverUrl) {
      await this.coverStorage.deleteByUrl(existing.coverUrl);
    }

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
    const archivedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.card.update({
        where: { id },
        data: { archivedAt },
      });
      await tx.shareLink.updateMany({
        where: { cardId: id, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: archivedAt },
      });
      // Wallet push so installed passes display as voided (greyed-out) in Wallet.
      await this.outbox.enqueue(tx, {
        dedupeKey: `wallet-push:${id}:${archivedAt.getTime()}`,
        kind: 'wallet_push',
        payload: { cardId: id },
      });
    });
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

  /**
   * Upload/replace this card's logo. Mirrors ProfileService.upsertPhoto()'s
   * shape: upload to storage first (so a rejected file never touches the
   * row), then swap the URL in, then best-effort delete whatever was there
   * before — never the other order, which would delete a still-referenced
   * object if the upload itself failed partway.
   */
  async uploadLogo(
    userId: string,
    cardId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<CardResponseDto> {
    const card = await this.findOwned(userId, cardId);
    const row = await this.attachLogo(cardId, card.logoUrl, file);
    this.logger.info('sharing.card_logo_uploaded', { userId, cardId });
    return this.toResponseDto(userId, row);
  }

  /**
   * Upload to storage, then swap the URL in, then best-effort delete
   * whatever was there before — never the other order, which would delete
   * a still-referenced object if the upload itself failed partway. Shared
   * by uploadLogo() (an existing card) and create() (a brand new one, where
   * `currentLogoUrl` is always null so the delete step is a no-op).
   */
  private async attachLogo(
    cardId: string,
    currentLogoUrl: string | null,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<CardWithFields> {
    const url = await this.logoStorage.upload(cardId, file);

    const row = await this.prisma.card.update({
      where: { id: cardId },
      data: { logoUrl: url },
      include: CARD_WITH_FIELDS_INCLUDE,
    });

    if (currentLogoUrl) {
      await this.logoStorage.deleteByUrl(currentLogoUrl);
    }

    return row;
  }

  async removeLogo(userId: string, cardId: string): Promise<void> {
    const card = await this.findOwned(userId, cardId);
    if (!card.logoUrl) {
      throw ApiError.notFound(
        'LOGO_NOT_FOUND',
        'This card has no logo to remove.',
      );
    }

    await this.prisma.card.update({
      where: { id: cardId },
      data: { logoUrl: null },
    });
    await this.logoStorage.deleteByUrl(card.logoUrl);
    this.logger.info('sharing.card_logo_removed', { userId, cardId });
  }

  /** Upload/replace this card's cover. Mirrors uploadLogo() exactly — see
   *  CardCoverStorageService for why the bytes are stored verbatim, no
   *  server-side crop/resize. */
  async uploadCover(
    userId: string,
    cardId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<CardResponseDto> {
    const card = await this.findOwned(userId, cardId);
    const row = await this.attachCover(cardId, card.coverUrl, file);
    this.logger.info('sharing.card_cover_uploaded', { userId, cardId });
    return this.toResponseDto(userId, row);
  }

  /** Mirrors attachLogo() exactly. */
  private async attachCover(
    cardId: string,
    currentCoverUrl: string | null,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<CardWithFields> {
    const url = await this.coverStorage.upload(cardId, file);

    const row = await this.prisma.card.update({
      where: { id: cardId },
      data: { coverUrl: url },
      include: CARD_WITH_FIELDS_INCLUDE,
    });

    if (currentCoverUrl) {
      await this.coverStorage.deleteByUrl(currentCoverUrl);
    }

    return row;
  }

  async removeCover(userId: string, cardId: string): Promise<void> {
    const card = await this.findOwned(userId, cardId);
    if (!card.coverUrl) {
      throw ApiError.notFound(
        'COVER_NOT_FOUND',
        'This card has no cover to remove.',
      );
    }

    await this.prisma.card.update({
      where: { id: cardId },
      data: { coverUrl: null },
    });
    await this.coverStorage.deleteByUrl(card.coverUrl);
    this.logger.info('sharing.card_cover_removed', { userId, cardId });
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
      logoUrl: card.logoUrl,
      coverUrl: card.coverUrl,
      headline: card.headline,
      bio: card.bio,
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
