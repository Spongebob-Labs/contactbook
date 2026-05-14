import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CardFieldMapping, ContactCard } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SyncService } from "../sync/sync.service";
import { AddCardFieldMappingDto } from "./dto/add-card-field-mapping.dto";
import { CreateContactCardDto } from "./dto/create-contact-card.dto";
import { UpdateContactCardDto } from "./dto/update-contact-card.dto";

@Injectable()
export class CardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
  ) {}

  async listCards(userId: string): Promise<ContactCard[]> {
    return this.prisma.contactCard.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
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
      },
    });
  }

  async deleteCard(userId: string, cardId: string): Promise<void> {
    await this.getCard(userId, cardId);
    await this.prisma.contactCard.delete({ where: { id: cardId } });
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
