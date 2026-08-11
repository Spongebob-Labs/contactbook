import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CardShareDispatchStatus,
  WhatsappMessageStatus,
  WhatsappTemplateUseCase,
  type Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { VCardGeneratorService } from "./vcard-generator.service";
import { WhatsappTemplateService } from "./whatsapp-template.service";
import { ShareCardDto, ShareCardRecipientDto } from "./dto/share-card.dto";
import { GenerateVcardDto } from "./dto/generate-vcard.dto";
import { VcardAssetResponseDto } from "./dto/vcard-asset-response.dto";
import { ListCardSharesQueryDto } from "./dto/list-card-shares-query.dto";
import { CardShareBatchResponseDto } from "./dto/card-share-batch-response.dto";
import { CardShareBatchListResponseDto } from "./dto/card-share-batch-list-response.dto";
import { CardShareRecipientResponseDto } from "./dto/card-share-recipient-response.dto";

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX_RECIPIENTS = 50;
const TERMINAL_DISPATCH_STATUSES = new Set<CardShareDispatchStatus>([
  CardShareDispatchStatus.FAILED,
]);

type BatchWithRecipients = Prisma.CardShareBatchGetPayload<{
  include: { recipients: true };
}>;

@Injectable()
export class CardShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vcardGenerator: VCardGeneratorService,
    private readonly templates: WhatsappTemplateService,
  ) {}

  async createBatch(
    userId: string,
    cardId: string,
    dto: ShareCardDto,
  ): Promise<CardShareBatchResponseDto> {
    const card = await this.prisma.contactCard.findFirst({
      where: { id: cardId, userId },
    });
    if (!card) {
      throw new NotFoundException("Card not found");
    }
    if (card.isSensitive) {
      throw new BadRequestException(
        "This card is marked sensitive and can't be shared over WhatsApp",
      );
    }

    const deduped = dedupeRecipients(dto.recipients);
    await this.assertContactsOwnedByUser(userId, deduped);
    await this.assertWithinRateLimit(userId, deduped.length);

    const template = await this.templates.resolveForSend(
      WhatsappTemplateUseCase.CARD_SHARE,
      dto.templateKey,
      userId,
    );
    const asset = await this.vcardGenerator.getOrCreateAsset(
      userId,
      card,
      dto.fieldTypes,
    );

    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cardShareBatch.create({
        data: {
          cardId: card.id,
          cardNameSnapshot: card.name,
          cardTypeSnapshot: card.type,
          senderId: userId,
          templateId: template.id,
          vcardAssetId: asset.id,
          note: dto.note,
        },
      });
      await tx.cardShareRecipient.createMany({
        data: deduped.map((recipient) => ({
          batchId: created.id,
          recipientCountryCode: recipient.countryCode,
          recipientPhone: recipient.phone,
          recipientContactId: recipient.contactId ?? null,
        })),
      });
      return created;
    });

    return this.getBatch(userId, batch.id);
  }

  async generateVcard(
    userId: string,
    cardId: string,
    dto: GenerateVcardDto,
  ): Promise<VcardAssetResponseDto> {
    const card = await this.prisma.contactCard.findFirst({
      where: { id: cardId, userId },
    });
    if (!card) throw new NotFoundException("Card not found");

    const asset = await this.vcardGenerator.getOrCreateAsset(
      userId,
      card,
      dto.fieldTypes,
    );
    return {
      objectKey: asset.objectKey,
      url: asset.storageUrl,
      fieldTypes: dto.fieldTypes,
      sizeBytes: asset.sizeBytes,
    };
  }

  async listBatchesForCard(
    userId: string,
    cardId: string,
    query: ListCardSharesQueryDto,
  ): Promise<CardShareBatchListResponseDto> {
    const card = await this.prisma.contactCard.findFirst({
      where: { id: cardId, userId },
      select: { id: true },
    });
    if (!card) {
      throw new NotFoundException("Card not found");
    }

    const skip = (query.page - 1) * query.limit;
    const [total, batches] = await Promise.all([
      this.prisma.cardShareBatch.count({ where: { cardId: card.id } }),
      this.prisma.cardShareBatch.findMany({
        where: { cardId: card.id },
        include: { recipients: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
      }),
    ]);

    return {
      items: batches.map((batch) => toBatchResponse(batch)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  async getBatch(
    userId: string,
    batchId: string,
  ): Promise<CardShareBatchResponseDto> {
    const batch = await this.loadBatchOrThrow(userId, batchId);
    return toBatchResponse(batch);
  }

  async resendRecipient(
    userId: string,
    batchId: string,
    recipientId: string,
  ): Promise<CardShareRecipientResponseDto> {
    const batch = await this.loadBatchOrThrow(userId, batchId);
    const recipient = batch.recipients.find((r) => r.id === recipientId);
    if (!recipient) {
      throw new NotFoundException("Recipient not found");
    }

    const isTerminal =
      TERMINAL_DISPATCH_STATUSES.has(recipient.dispatchStatus) ||
      recipient.deliveryStatus === WhatsappMessageStatus.FAILED;
    if (!isTerminal) {
      throw new ConflictException(
        "Recipient is not in a terminal failed state",
      );
    }

    const updated = await this.prisma.cardShareRecipient.update({
      where: { id: recipient.id },
      data: {
        dispatchStatus: CardShareDispatchStatus.PENDING,
        dispatchAttempts: 0,
        nextAttemptAt: new Date(),
        lastDispatchError: null,
      },
    });
    return toRecipientResponse(updated);
  }

  private async loadBatchOrThrow(userId: string, batchId: string) {
    const batch = await this.prisma.cardShareBatch.findFirst({
      where: { id: batchId, senderId: userId },
      include: { recipients: true },
    });
    if (!batch) {
      throw new NotFoundException("Share batch not found");
    }
    return batch;
  }

  private async assertContactsOwnedByUser(
    userId: string,
    recipients: ShareCardRecipientDto[],
  ): Promise<void> {
    const contactIds = [
      ...new Set(
        recipients
          .map((r) => r.contactId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (contactIds.length === 0) {
      return;
    }
    const owned = await this.prisma.contact.findMany({
      where: { id: { in: contactIds }, userId },
      select: { id: true },
    });
    if (owned.length !== contactIds.length) {
      throw new BadRequestException(
        "One or more recipients reference a contact that doesn't belong to you",
      );
    }
  }

  private async assertWithinRateLimit(
    userId: string,
    incomingCount: number,
  ): Promise<void> {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recent = await this.prisma.cardShareRecipient.findMany({
      where: { batch: { senderId: userId }, createdAt: { gte: since } },
      select: { recipientCountryCode: true, recipientPhone: true },
    });
    const distinctRecipients = new Set(
      recent.map((r) => `${r.recipientCountryCode}:${r.recipientPhone}`),
    );
    if (distinctRecipients.size + incomingCount > RATE_LIMIT_MAX_RECIPIENTS) {
      throw new HttpException(
        `You can share a card with at most ${RATE_LIMIT_MAX_RECIPIENTS} distinct recipients per rolling 24 hours`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

function dedupeRecipients(
  recipients: ShareCardRecipientDto[],
): ShareCardRecipientDto[] {
  const byKey = new Map<string, ShareCardRecipientDto>();
  for (const recipient of recipients) {
    byKey.set(`${recipient.countryCode}:${recipient.phone}`, recipient);
  }
  return [...byKey.values()];
}

function toBatchResponse(
  batch: BatchWithRecipients,
): CardShareBatchResponseDto {
  return {
    id: batch.id,
    cardId: batch.cardId,
    cardName: batch.cardNameSnapshot,
    cardType: batch.cardTypeSnapshot,
    note: batch.note,
    createdAt: batch.createdAt,
    recipients: batch.recipients.map((r) => toRecipientResponse(r)),
  };
}

function toRecipientResponse(
  recipient: BatchWithRecipients["recipients"][number],
): CardShareRecipientResponseDto {
  return {
    id: recipient.id,
    countryCode: recipient.recipientCountryCode,
    phone: recipient.recipientPhone,
    contactId: recipient.recipientContactId,
    dispatchStatus: recipient.dispatchStatus,
    deliveryStatus: recipient.deliveryStatus,
    lastDispatchError: recipient.lastDispatchError,
    sentAt: recipient.sentAt,
    deliveredAt: recipient.deliveredAt,
    readAt: recipient.readAt,
    failedAt: recipient.failedAt,
    createdAt: recipient.createdAt,
  };
}
