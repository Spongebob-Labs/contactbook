import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, ShareLink } from '@prisma/client';
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

/** The include shape both public-resolve paths (ShareLink and Card.publicToken) need. */
const PUBLIC_CARD_INCLUDE = {
  user: { select: { firstName: true, lastName: true } },
  fields: {
    where: { visible: true },
    orderBy: { position: 'asc' as const },
    include: { field: true },
  },
} satisfies Prisma.CardInclude;

type CardForPublicResolve = Prisma.CardGetPayload<{
  include: typeof PUBLIC_CARD_INCLUDE;
}>;

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
      // lastNotifiedVersion is set here on both branches, never left null for
      // an active link — the initial share already hands the recipient a
      // live link to current data, so if this stayed null a contact shared
      // at version 5 would read as "5 versions behind" with nothing to
      // compare against. null should mean "this link has never told anyone
      // anything," a state that isn't reachable once a link is actually live.
      const linkRow = existing
        ? // Re-sharing a revoked link is how an owner un-revokes it for someone
          // — explicit intent to give them access again, restoring the SAME
          // token rather than minting a new one.
          await tx.shareLink.update({
            where: { id: existing.id },
            data: {
              status: 'ACTIVE',
              revokedAt: null,
              lastNotifiedVersion: card.currentVersion,
            },
          })
        : await tx.shareLink.create({
            data: {
              token: generateShareToken(),
              cardId,
              contactId: contact.id,
              lastNotifiedVersion: card.currentVersion,
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
   * token, 410 (ApiError.gone) for a known-but-revoked/archived one, so a
   * recipient understands what happened rather than seeing a generic error
   * either way.
   *
   * Two token namespaces, one route: a per-contact ShareLink token is tried
   * first (existing behaviour, unchanged); a miss falls back to a card's own
   * `publicToken` — what its QR encodes before it's ever been shared with
   * anyone. Putting a per-contact token in a QR would be wrong, not just a
   * shortcut: revoking one contact would kill the printed QR for everyone,
   * and a stranger's scan would inflate a real recipient's viewCount. Both
   * namespaces are 128-bit base62 from the same generator, so cross-namespace
   * collision is not a practical risk — no reason to expose this as two
   * routes, which would just make the recipient's phone responsible for
   * knowing which kind of link it's holding.
   */
  async resolvePublic(token: string): Promise<PublicCardResponseDto> {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      include: { card: { include: PUBLIC_CARD_INCLUDE } },
    });

    if (link) {
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

      return this.assemblePublicCard(link.card);
    }

    const card = await this.prisma.card.findUnique({
      where: { publicToken: token },
      include: PUBLIC_CARD_INCLUDE,
    });

    if (!card) {
      throw ApiError.notFound(
        'SHARE_LINK_NOT_FOUND',
        'This link does not exist.',
      );
    }
    if (card.archivedAt !== null) {
      throw ApiError.gone(
        'SHARE_LINK_REVOKED',
        'This link has been revoked by its owner.',
      );
    }

    // Fire-and-forget, same style as the viewCount bump above — a scan is an
    // anonymous stranger with no ShareLink row to increment, so this is
    // CardScan's whole reason to exist. Never allowed to fail the page load.
    void this.prisma.cardScan
      .create({ data: { cardId: card.id } })
      .catch((err) =>
        this.logger.error('sharing.card_scan_write_failed', {
          cardId: card.id,
          err: err instanceof Error ? err.message : String(err),
        }),
      );

    return this.assemblePublicCard(card);
  }

  private async assemblePublicCard(
    card: CardForPublicResolve,
  ): Promise<PublicCardResponseDto> {
    const ownerId = card.userId;
    const photo = await this.prisma.profileField.findFirst({
      where: { userId: ownerId, type: 'PHOTO', archivedAt: null },
      select: { value: true },
    });

    const name = [card.user.firstName, card.user.lastName]
      .filter(Boolean)
      .join(' ');

    return {
      owner: {
        name: name.length > 0 ? name : null,
        photoUrl: photo?.value ?? null,
      },
      card: {
        name: card.name,
        kind: card.kind,
        templateId: card.templateId,
        paletteId: card.paletteId,
        groundHex: card.groundHex,
        finish: card.finish,
        texture: card.texture,
        texturePresence: card.texturePresence,
        textureScale: card.textureScale,
        updatedAt: card.updatedAt,
      },
      fields: card.fields
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
                cardId: card.id,
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
