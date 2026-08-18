import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CardFieldMapping, ContactCard } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SyncService } from "../sync/sync.service";
import { buildCardSlug } from "./card-slug.util";
import { AddCardFieldMappingDto } from "./dto/add-card-field-mapping.dto";
import { CreateContactCardDto } from "./dto/create-contact-card.dto";
import { UpdateContactCardDto } from "./dto/update-contact-card.dto";

/** Slug candidates to try before admitting defeat on collisions. */
const SLUG_MINT_ATTEMPTS = 5;

/** Shape a slug must have before it earns a database round trip. */
const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

/** Prisma reports a unique-index clash as P2002. */
function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

@Injectable()
export class CardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
  ) {}

  async listCards(userId: string): Promise<Omit<ContactCard, "publishedSnapshot">[]> {
    return this.prisma.contactCard.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      // Deliberately omits publishedSnapshot: it carries an inline photo data
      // URL, so listing ten cards would otherwise ship close to a megabyte.
      // The detail endpoint returns it, which is where the builder seeds from.
      select: {
        id: true,
        userId: true,
        name: true,
        type: true,
        isSensitive: true,
        slug: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createCard(
    userId: string,
    dto: CreateContactCardDto,
  ): Promise<ContactCard> {
    return this.prisma.contactCard.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type ?? undefined,
      },
    });
  }

  async getCard(userId: string, cardId: string): Promise<ContactCard> {
    const card = await this.prisma.contactCard.findFirst({
      where: { id: cardId, userId },
    });
    if (!card) {
      throw new NotFoundException("Card not found");
    }
    return card;
  }

  async updateCard(
    userId: string,
    cardId: string,
    dto: UpdateContactCardDto,
  ): Promise<ContactCard> {
    await this.getCard(userId, cardId);
    return this.prisma.contactCard.update({
      where: { id: cardId },
      data: {
        name: dto.name,
        type: dto.type,
        isSensitive: dto.isSensitive,
      },
    });
  }

  async deleteCard(userId: string, cardId: string): Promise<void> {
    await this.getCard(userId, cardId);
    await this.prisma.contactCard.delete({ where: { id: cardId } });
  }

  /**
   * Publish or re-publish a card to its public link.
   *
   * The snapshot is opaque and versioned by the web client; the API stores it
   * verbatim so new layouts, themes and block types never require a migration.
   */
  async publishCard(
    userId: string,
    cardId: string,
    snapshot: Record<string, unknown>,
  ): Promise<ContactCard> {
    const card = await this.getCard(userId, cardId);

    // Prisma's InputJsonValue is recursive and cannot be satisfied by a type
    // with `unknown` leaves. The DTO has already validated that this is a plain
    // object, and we store it without interpreting it, so one cast at the
    // persistence boundary is the honest place to absorb that mismatch.
    const payload = snapshot as Prisma.InputJsonObject;

    // A slug is minted once and then kept for the life of the card, including
    // across unpublish, so QR codes and Wallet passes already handed out keep
    // resolving. Re-publishing must never move the URL.
    if (card.slug) {
      return this.prisma.contactCard.update({
        where: { id: cardId },
        data: { publishedSnapshot: payload, publishedAt: new Date() },
      });
    }

    for (let attempt = 0; attempt < SLUG_MINT_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.contactCard.update({
          where: { id: cardId },
          data: {
            slug: buildCardSlug(card.name),
            publishedSnapshot: payload,
            publishedAt: new Date(),
          },
        });
      } catch (error) {
        // Let the unique index arbitrate instead of checking availability
        // first — a read-then-write would race two publishes onto one slug.
        if (!isUniqueConstraintViolation(error)) {
          throw error;
        }
      }
    }

    throw new ConflictException("Could not allocate a card link. Try again.");
  }

  /** Take a card offline without surrendering its slug. */
  async unpublishCard(userId: string, cardId: string): Promise<ContactCard> {
    await this.getCard(userId, cardId);
    return this.prisma.contactCard.update({
      where: { id: cardId },
      // Prisma.DbNull writes a SQL NULL; a bare `null` on a Json column would
      // be read as the JSON literal null instead.
      data: { publishedSnapshot: Prisma.DbNull, publishedAt: null },
    });
  }

  /**
   * Unauthenticated read for the public card page.
   *
   * Returns the snapshot only — never the owner id, card name, type or
   * sensitivity flag. An unpublished slug 404s exactly like an unknown one, so
   * the response cannot be used to confirm that a slug belongs to somebody.
   */
  async getPublishedBySlug(slug: string): Promise<{
    slug: string;
    snapshot: Prisma.JsonValue;
    publishedAt: Date | null;
  }> {
    const unavailable = new NotFoundException("This card is not available.");

    if (!SLUG_PATTERN.test(slug)) {
      throw unavailable;
    }

    const card = await this.prisma.contactCard.findUnique({
      where: { slug },
      select: { slug: true, publishedSnapshot: true, publishedAt: true },
    });

    // We only ever write Prisma.DbNull, never a JSON null literal, so a null
    // here unambiguously means "not currently published".
    if (!card?.slug || card.publishedSnapshot === null) {
      throw unavailable;
    }

    return {
      slug: card.slug,
      snapshot: card.publishedSnapshot,
      publishedAt: card.publishedAt,
    };
  }

  async listMappings(
    userId: string,
    cardId: string,
  ): Promise<CardFieldMapping[]> {
    await this.getCard(userId, cardId);
    return this.prisma.cardFieldMapping.findMany({ where: { cardId } });
  }

  async addMapping(
    userId: string,
    cardId: string,
    dto: AddCardFieldMappingDto,
  ): Promise<CardFieldMapping> {
    await this.getCard(userId, cardId);
    const field = await this.prisma.profileField.findFirst({
      where: { id: dto.fieldId, group: { userId } },
    });
    if (!field) {
      throw new ForbiddenException("Field not found for this user");
    }
    try {
      const row = await this.prisma.cardFieldMapping.create({
        data: { cardId, fieldId: dto.fieldId },
      });
      await this.sync.notifyCardSubscribers(cardId);
      return row;
    } catch {
      throw new BadRequestException("Mapping already exists");
    }
  }

  async removeMapping(
    userId: string,
    cardId: string,
    fieldId: string,
  ): Promise<void> {
    await this.getCard(userId, cardId);
    const res = await this.prisma.cardFieldMapping.deleteMany({
      where: { cardId, fieldId },
    });
    if (res.count === 0) {
      throw new NotFoundException("Mapping not found");
    }
    await this.sync.notifyCardSubscribers(cardId);
  }
}
