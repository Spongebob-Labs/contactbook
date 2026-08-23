import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ShareLink } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { ApiError } from '../common/errors/api-error';
import { decryptFieldValueForRead } from '../profile/profile-field-value.util';
import { ContactsService } from '../contacts/contacts.service';
import { OutboxService } from '../outbox/outbox.service';
import { TaskEnqueuer } from '../outbox/task-enqueuer';
import { CardsService } from './cards.service';
import { generateShareToken } from './share-token.util';
import { ShareCardDto } from './dto/share-card.dto';
import { UpdateShareLinkDto } from './dto/update-share-link.dto';
import { ShareLinkResponseDto } from './dto/share-link-response.dto';
import { PublicCardResponseDto } from './dto/public-card-response.dto';

type ShareLinkWithContactAndCard = ShareLink & {
  card: { name: string };
  contact: { phoneE164: string; displayName: string | null };
};

@Injectable()
export class ShareLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
    private readonly cards: CardsService,
    private readonly contacts: ContactsService,
    private readonly outbox: OutboxService,
    private readonly enqueuer: TaskEnqueuer,
  ) {}

  /**
   * Mints (or reuses) the share link for (card, contact) — invariant #1:
   * never a second token for a pair that already has one. Only enqueues a
   * WhatsApp send when there is something to notify about — a brand new
   * link, or restoring a previously-revoked one. Calling this again on an
   * already-ACTIVE link is a no-op on the messaging side (just re-returns
   * the existing link), so a client that re-fetches "the link" defensively
   * doesn't spam the contact with repeat messages.
   *
   * The actual send will fail cleanly with CARD_SHARE_TEMPLATE_NOT_CONFIGURED
   * until a WhatsAppTemplate for CARD_SHARE is registered and approved (see
   * messaging/whatsapp-template.service.ts) — the link itself is real and
   * live either way; copy-pasting the returned url works right now.
   */
  async share(
    userId: string,
    cardId: string,
    dto: ShareCardDto,
  ): Promise<ShareLinkResponseDto> {
    const card = await this.cards.findOwned(userId, cardId);
    const contact = await this.contacts.findOwned(userId, dto.contactId);

    const existing = await this.prisma.shareLink.findUnique({
      where: { cardId_contactId: { cardId, contactId: contact.id } },
    });

    if (existing && existing.status === 'ACTIVE') {
      return this.toResponseDto({
        ...existing,
        card: { name: card.name },
        contact: {
          phoneE164: contact.phoneE164,
          displayName: contact.displayName,
        },
      });
    }

    const owner = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const ownerName =
      [owner.firstName, owner.lastName].filter(Boolean).join(' ') || 'Someone';

    // ShareLink write + outbox enqueue in the SAME transaction — architecture
    // invariant #3. The transport (this.enqueuer.enqueue) is deliberately
    // outside the transaction and fires only after it commits.
    const { link, outboxId } = await this.prisma.$transaction(async (tx) => {
      const linkRow = existing
        ? // Re-sharing a revoked link is how an owner un-revokes it for someone
          // — explicit intent to give them access again, restoring the SAME
          // token rather than minting a new one.
          await tx.shareLink.update({
            where: { id: existing.id },
            data: { status: 'ACTIVE', revokedAt: null },
          })
        : await tx.shareLink.create({
            data: {
              token: generateShareToken(),
              cardId,
              contactId: contact.id,
            },
          });

      const outboxRow = await this.outbox.enqueue(tx, {
        // Suffixed with a fresh uuid, not just the ShareLink id: re-sharing
        // reuses the same ShareLink but should still be able to re-send. This
        // trades OTP-grade retry dedup (see auth/otp.service.ts) for that —
        // an acceptable trade here since a duplicate card-share message is a
        // minor annoyance, not a security issue the way a duplicate OTP is.
        dedupeKey: `card_share:${linkRow.id}:${randomUUID()}`,
        kind: 'send_whatsapp_card_share',
        payload: {
          shareLinkId: linkRow.id,
          contactPhoneE164: contact.phoneE164,
          ownerName,
          shareToken: linkRow.token,
        },
      });

      return { link: linkRow, outboxId: outboxRow.id };
    });

    this.enqueuer.enqueue(outboxId, 'outbound');
    this.logger.info('sharing.card_share_enqueued', {
      shareLinkId: link.id,
      cardId,
      contactId: contact.id,
    });

    return this.toResponseDto({
      ...link,
      card: { name: card.name },
      contact: {
        phoneE164: contact.phoneE164,
        displayName: contact.displayName,
      },
    });
  }

  async list(userId: string): Promise<ShareLinkResponseDto[]> {
    const rows = await this.prisma.shareLink.findMany({
      where: { card: { userId } },
      orderBy: { createdAt: 'desc' },
      include: {
        card: { select: { name: true } },
        contact: { select: { phoneE164: true, displayName: true } },
      },
    });
    return rows.map((r) => this.toResponseDto(r));
  }

  async updateStatus(
    userId: string,
    id: string,
    dto: UpdateShareLinkDto,
  ): Promise<ShareLinkResponseDto> {
    const existing = await this.prisma.shareLink.findFirst({
      where: { id, card: { userId } },
      include: {
        card: { select: { name: true } },
        contact: { select: { phoneE164: true, displayName: true } },
      },
    });
    if (!existing) {
      throw ApiError.notFound(
        'SHARE_LINK_NOT_FOUND',
        'No share link with that id.',
      );
    }

    const row = await this.prisma.shareLink.update({
      where: { id },
      data: {
        status: dto.status,
        revokedAt: dto.status === 'REVOKED' ? new Date() : null,
      },
    });
    return this.toResponseDto({
      ...row,
      card: existing.card,
      contact: existing.contact,
    });
  }

  /**
   * The live public resolver — no auth, no userId scoping. Every read here
   * happens at request time; nothing about this method may read from a
   * cache or a snapshot (architecture invariant #2). 404 for an unknown
   * token, 410 (ApiError.gone) for a known-but-revoked one, so a recipient
   * understands what happened rather than seeing a generic error either way.
   */
  async resolvePublic(token: string): Promise<PublicCardResponseDto> {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      include: {
        card: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
            fields: {
              where: { visible: true },
              orderBy: { position: 'asc' },
              include: { field: true },
            },
          },
        },
      },
    });

    if (!link) {
      throw ApiError.notFound(
        'SHARE_LINK_NOT_FOUND',
        'This link does not exist.',
      );
    }
    if (link.status === 'REVOKED' || link.card.archivedAt !== null) {
      // card.archivedAt is checked independently of status, even though
      // CardsService.archive() always revokes every ShareLink in the same
      // transaction — belt-and-suspenders per docs/architecture/lld.md §2,
      // in case that invariant is ever violated by a bug or a future write
      // path that forgets the cascade.
      throw ApiError.gone(
        'SHARE_LINK_REVOKED',
        'This link has been revoked by its owner.',
      );
    }

    await this.prisma.shareLink.update({
      where: { id: link.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
        firstViewedAt: link.firstViewedAt ?? new Date(),
      },
    });

    const ownerId = link.card.userId;
    const photo = await this.prisma.profileField.findFirst({
      where: { userId: ownerId, type: 'PHOTO', archivedAt: null },
      select: { value: true },
    });

    const name = [link.card.user.firstName, link.card.user.lastName]
      .filter(Boolean)
      .join(' ');

    return {
      owner: {
        name: name.length > 0 ? name : null,
        photoUrl: photo?.value ?? null,
      },
      card: {
        name: link.card.name,
        kind: link.card.kind,
        updatedAt: link.card.updatedAt,
      },
      fields: link.card.fields
        // Excludes a field that was archived after being added to the card
        // — CardField rows aren't cleaned up when their ProfileField is
        // archived, so this filters live rather than relying on a cascade.
        .filter((cf) => cf.field.archivedAt === null)
        .map((cf) => ({
          type: cf.field.type,
          label: cf.labelOverride ?? cf.field.label,
          value: decryptFieldValueForRead(
            this.config.fieldEncryptionKey,
            { userId: ownerId, fieldId: cf.field.id, type: cf.field.type },
            cf.field.value,
            cf.field.isEncrypted,
            (err) =>
              this.logger.error('sharing.public_field_decryption_failed', {
                shareLinkId: link.id,
                fieldId: cf.field.id,
                err: err instanceof Error ? err.message : String(err),
              }),
          ),
        })),
    };
  }

  private buildUrl(token: string): string {
    return `${this.config.shareBaseUrl.replace(/\/+$/, '')}/c/${token}`;
  }

  private toResponseDto(
    row: ShareLinkWithContactAndCard,
  ): ShareLinkResponseDto {
    return {
      id: row.id,
      url: this.buildUrl(row.token),
      cardId: row.cardId,
      cardName: row.card.name,
      contactId: row.contactId,
      contactPhoneE164: row.contact.phoneE164,
      contactDisplayName: row.contact.displayName,
      status: row.status,
      viewCount: row.viewCount,
      firstViewedAt: row.firstViewedAt,
      lastViewedAt: row.lastViewedAt,
      createdAt: row.createdAt,
    };
  }
}
