import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ContactCard,
  ProfileField,
  SensitiveFieldAccessRequest,
  WhatsappFlowState,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { e164FromStoredUser } from "../common/phone.util";
import { PrismaService } from "../prisma/prisma.service";
import { TwilioService } from "../integration/twilio.service";
import { SyncService } from "../sync/sync.service";
import { CreateContactCardDto } from "./dto/create-contact-card.dto";
import { CreateProfileFieldDto } from "./dto/create-profile-field.dto";
import { CreateSensitiveFieldRequestDto } from "./dto/create-sensitive-field-request.dto";
import { UpdateContactCardDto } from "./dto/update-contact-card.dto";
import { UpdateProfileFieldDto } from "./dto/update-profile-field.dto";

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioService,
    private readonly sync: SyncService,
  ) {}

  async listCards(userId: string): Promise<ContactCard[]> {
    return this.prisma.contactCard.findMany({
      where: { userId, isArchived: false },
      orderBy: { sortOrder: "asc" },
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
        sortOrder: dto.sortOrder ?? 0,
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
        sortOrder: dto.sortOrder,
        isArchived: dto.isArchived,
      },
    });
  }

  async deleteCard(userId: string, cardId: string): Promise<void> {
    await this.getCard(userId, cardId);
    await this.prisma.contactCard.delete({ where: { id: cardId } });
  }

  async listFields(userId: string, cardId: string): Promise<ProfileField[]> {
    await this.getCard(userId, cardId);
    return this.prisma.profileField.findMany({
      where: { contactCardId: cardId },
      orderBy: { sortOrder: "asc" },
    });
  }

  async createField(
    userId: string,
    cardId: string,
    dto: CreateProfileFieldDto,
  ): Promise<ProfileField> {
    await this.getCard(userId, cardId);
    const field = await this.prisma.profileField.create({
      data: {
        contactCardId: cardId,
        key: dto.key,
        label: dto.label,
        value: dto.value ?? null,
        valueType: dto.valueType ?? "STRING",
        isSensitive: dto.isSensitive ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.sync.notifyCardSubscribers(cardId);
    return field;
  }

  async updateField(
    userId: string,
    fieldId: string,
    dto: UpdateProfileFieldDto,
  ): Promise<ProfileField> {
    const field = await this.prisma.profileField.findFirst({
      where: { id: fieldId, contactCard: { userId } },
      include: { contactCard: true },
    });
    if (!field) {
      throw new NotFoundException("Field not found");
    }
    const updated = await this.prisma.profileField.update({
      where: { id: fieldId },
      data: {
        label: dto.label,
        value: dto.value,
        valueType: dto.valueType,
        isSensitive: dto.isSensitive,
        sortOrder: dto.sortOrder,
      },
    });
    await this.sync.notifyCardSubscribers(field.contactCardId);
    return updated;
  }

  async deleteField(userId: string, fieldId: string): Promise<void> {
    const field = await this.prisma.profileField.findFirst({
      where: { id: fieldId, contactCard: { userId } },
    });
    if (!field) {
      throw new NotFoundException("Field not found");
    }
    await this.prisma.profileField.delete({ where: { id: fieldId } });
    await this.sync.notifyCardSubscribers(field.contactCardId);
  }

  async createSensitiveFieldRequest(
    requesterId: string,
    dto: CreateSensitiveFieldRequestDto,
  ): Promise<SensitiveFieldAccessRequest> {
    const field = await this.prisma.profileField.findUnique({
      where: { id: dto.profileFieldId },
      include: { contactCard: true },
    });
    if (!field) {
      throw new NotFoundException("Field not found");
    }
    const ownerId = field.contactCard.userId;
    if (ownerId === requesterId) {
      throw new BadRequestException("Cannot request your own field");
    }
    if (!field.isSensitive) {
      throw new BadRequestException("Field is not marked sensitive");
    }
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner?.phone) {
      throw new BadRequestException("Owner has no phone on file");
    }
    const correlationId = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const request = await this.prisma.sensitiveFieldAccessRequest.create({
      data: {
        requesterId,
        ownerId,
        profileFieldId: field.id,
        expiresAt,
        twilioCorrelationId: correlationId,
      },
    });
    const ownerE164 = e164FromStoredUser(owner);
    await this.prisma.whatsappSession.create({
      data: {
        userId: ownerId,
        phoneE164: ownerE164,
        state: WhatsappFlowState.AWAITING_SENSITIVE_FIELD_APPROVAL,
        correlationId,
        metadata: { sensitiveRequestId: request.id },
        expiresAt,
      },
    });
    await this.twilio.sendWhatsApp(
      ownerE164,
      `ContactBook: someone requested access to a sensitive field (${field.label}). Reply APPROVE-SFR-${request.id} or DECLINE-SFR-${request.id}.`,
    );
    return request;
  }
}
