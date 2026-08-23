import { Injectable } from '@nestjs/common';
import { ShareLink } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { ApiError } from '../common/errors/api-error';
import { decryptFieldValueForRead } from '../profile/profile-field-value.util';
import { RecipientsService } from '../recipients/recipients.service';
import { CardsService } from './cards.service';
import { generateShareToken } from './share-token.util';
import { ShareCardDto } from './dto/share-card.dto';
import { UpdateShareLinkDto } from './dto/update-share-link.dto';
import { ShareLinkResponseDto } from './dto/share-link-response.dto';
import { PublicCardResponseDto } from './dto/public-card-response.dto';

type ShareLinkWithRecipientAndCard = ShareLink & {
  card: { name: string };
  recipient: { phoneE164: string; displayName: string | null };
};

@Injectable()
export class ShareLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
    private readonly cards: CardsService,
    private readonly recipients: RecipientsService,
  ) {}

  /**
   * Mints (or reuses) the share link for (card, recipient) — invariant #1:
   * never a second token for a pair that already has one. Does NOT send a
   * WhatsApp message: there is no active CARD_SHARE template to send with
   * yet (see messaging/whatsapp-template.service.ts). The owner gets a real,
   * live URL back either way — copy-pasting it works today.
   */
  async share(
    userId: string,
    cardId: string,
    dto: ShareCardDto,
  ): Promise<ShareLinkResponseDto> {
    const card = await this.cards.findOwned(userId, cardId);
    const recipient = await this.recipients.upsertByPhone(userId, {
      phoneE164: dto.recipientPhoneE164,
      displayName: dto.recipientDisplayName,
    });

    const existing = await this.prisma.shareLink.findUnique({
      where: { cardId_recipientId: { cardId, recipientId: recipient.id } },
    });

    let row: ShareLink;
    if (existing) {
      // Re-sharing is how an owner un-revokes a link for someone — explicit
      // intent to give this person access again, restoring the SAME token
      // rather than minting a new one.
      row =
        existing.status === 'REVOKED'
          ? await this.prisma.shareLink.update({
              where: { id: existing.id },
              data: { status: 'ACTIVE', revokedAt: null },
            })
          : existing;
    } else {
      row = await this.prisma.shareLink.create({
        data: {
          token: generateShareToken(),
          cardId,
          recipientId: recipient.id,
        },
      });
    }

    return this.toResponseDto({
      ...row,
      card: { name: card.name },
      recipient: {
        phoneE164: recipient.phoneE164,
        displayName: recipient.displayName,
      },
    });
  }

  async list(userId: string): Promise<ShareLinkResponseDto[]> {
    const rows = await this.prisma.shareLink.findMany({
      where: { card: { userId } },
      orderBy: { createdAt: 'desc' },
      include: {
        card: { select: { name: true } },
        recipient: { select: { phoneE164: true, displayName: true } },
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
        recipient: { select: { phoneE164: true, displayName: true } },
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
      recipient: existing.recipient,
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
    row: ShareLinkWithRecipientAndCard,
  ): ShareLinkResponseDto {
    return {
      id: row.id,
      url: this.buildUrl(row.token),
      cardId: row.cardId,
      cardName: row.card.name,
      recipientId: row.recipientId,
      recipientPhoneE164: row.recipient.phoneE164,
      recipientDisplayName: row.recipient.displayName,
      status: row.status,
      viewCount: row.viewCount,
      firstViewedAt: row.firstViewedAt,
      lastViewedAt: row.lastViewedAt,
      createdAt: row.createdAt,
    };
  }
}
