import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ConnectionStatus,
  WhatsappMessagePurpose,
  WhatsappFlowState,
  type Connection,
  type ContactCard,
  type User,
} from "@prisma/client";
import {
  contactCardToNormalizedContact,
  type ProfileFieldWithDetails,
} from "../contacts/contact-card-to-normalized.adapter";
import { ContactUpsertService } from "../contacts/contact-upsert.service";
import { e164FromStoredUser } from "../common/phone.util";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappMessagingService } from "../messaging/whatsapp-messaging.service";
import {
  buildCardOptions,
  formatCardSelectionMessage,
} from "./connection-card-prompt.util";
import {
  connectionSessionExpiresAt,
  type ConnectionCardOption,
  type WhatsappSessionCardMetadata,
} from "./connection-flow.types";

export type ShareCardRole = "recipient" | "requester";

export type ShareCardResult = {
  connection: Connection;
  completed: boolean;
  sharedCard: ContactCard;
};

@Injectable()
export class ConnectionShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contactUpsert: ContactUpsertService,
    private readonly messaging: WhatsappMessagingService,
  ) {}

  async listCardsForUser(userId: string): Promise<ContactCard[]> {
    return this.prisma.contactCard.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  async getCardOptions(userId: string): Promise<ConnectionCardOption[]> {
    const cards = await this.listCardsForUser(userId);
    return buildCardOptions(cards);
  }

  async loadCardFieldsForShare(
    userId: string,
    cardId: string,
  ): Promise<ProfileFieldWithDetails[]> {
    const card = await this.prisma.contactCard.findFirst({
      where: { id: cardId, userId },
      include: {
        fieldMappings: {
          include: {
            field: { include: { address: true } },
          },
        },
      },
    });
    if (!card) {
      throw new ForbiddenException("Card not found for this user");
    }
    return card.fieldMappings.map((m) => m.field);
  }

  async shareCard(
    connectionId: string,
    actorUserId: string,
    cardId: string,
    role: ShareCardRole,
  ): Promise<ShareCardResult> {
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId },
      include: { requester: true, receiver: true },
    });
    if (!connection || connection.status !== ConnectionStatus.PENDING) {
      throw new NotFoundException("Pending connection not found");
    }

    if (role === "recipient") {
      if (connection.receiverId !== actorUserId) {
        throw new ForbiddenException("Only the recipient can share this card");
      }
      if (connection.receiverSharedCardId) {
        throw new BadRequestException("Recipient has already shared a card");
      }
    } else {
      if (connection.requesterId !== actorUserId) {
        throw new ForbiddenException("Only the requester can share this card");
      }
      if (!connection.receiverSharedCardId) {
        throw new BadRequestException(
          "Recipient must share a card before the requester",
        );
      }
      if (connection.requesterSharedCardId) {
        throw new BadRequestException("Requester has already shared a card");
      }
    }

    const sharer: User =
      role === "recipient" ? connection.receiver : connection.requester;
    const peer: User =
      role === "recipient" ? connection.requester : connection.receiver;

    const card = await this.prisma.contactCard.findFirst({
      where: { id: cardId, userId: sharer.id },
    });
    if (!card) {
      throw new ForbiddenException("Card not found for this user");
    }

    const fields = await this.loadCardFieldsForShare(sharer.id, cardId);
    const normalized = contactCardToNormalizedContact(sharer, fields);
    await this.contactUpsert.upsert(peer.id, normalized);

    const updateData =
      role === "recipient"
        ? { receiverSharedCardId: cardId }
        : { requesterSharedCardId: cardId };

    const updated = await this.prisma.connection.update({
      where: { id: connectionId },
      data: updateData,
    });

    const completed =
      updated.receiverSharedCardId != null &&
      updated.requesterSharedCardId != null;

    if (completed) {
      await this.prisma.connection.update({
        where: { id: connectionId },
        data: {
          status: ConnectionStatus.ACCEPTED,
          hasSharedBack: true,
        },
      });
      await this.clearConnectionSessions(connectionId);
    }

    const finalConn = await this.prisma.connection.findUniqueOrThrow({
      where: { id: connectionId },
    });

    return {
      connection: finalConn,
      completed,
      sharedCard: card,
    };
  }

  async beginRecipientCardSelection(
    connectionId: string,
    receiverUserId: string,
  ): Promise<ConnectionCardOption[]> {
    const connection = await this.prisma.connection.findFirst({
      where: {
        id: connectionId,
        receiverId: receiverUserId,
        status: ConnectionStatus.PENDING,
      },
      include: { requester: true, receiver: true },
    });
    if (!connection) {
      throw new NotFoundException("Pending connection not found");
    }

    const cards = await this.listCardsForUser(receiverUserId);
    if (cards.length === 0) {
      throw new BadRequestException("No cards available");
    }

    const options = buildCardOptions(cards);
    const metadata: WhatsappSessionCardMetadata = { cardOptions: options };
    const who =
      `${connection.requester.firstName} ${connection.requester.lastName}`.trim() ||
      "Someone";

    await this.prisma.whatsappSession.updateMany({
      where: {
        connectionId,
        state: WhatsappFlowState.AWAITING_CONNECTION_ACCEPT,
      },
      data: {
        state: WhatsappFlowState.AWAITING_RECIPIENT_CARD_SELECTION,
        metadata,
        expiresAt: connectionSessionExpiresAt(),
      },
    });

    const prompt = formatCardSelectionMessage(
      `Which card would you like to share with ${who}?`,
      options,
    );
    await this.messaging.sendText({
      toE164: e164FromStoredUser(connection.receiver),
      text: prompt,
      purpose: WhatsappMessagePurpose.CARD_SELECTION,
      correlationId: connectionId,
    });

    return options;
  }

  async beginRequesterCardSelection(
    connectionId: string,
    requesterUserId: string,
    recipientCardName: string,
  ): Promise<ConnectionCardOption[]> {
    const connection = await this.prisma.connection.findFirst({
      where: {
        id: connectionId,
        requesterId: requesterUserId,
        status: ConnectionStatus.PENDING,
        receiverSharedCardId: { not: null },
      },
      include: { requester: true, receiver: true },
    });
    if (!connection) {
      throw new NotFoundException("Connection not ready for requester card");
    }

    const cards = await this.listCardsForUser(requesterUserId);
    if (cards.length === 0) {
      throw new BadRequestException("No cards available");
    }

    const options = buildCardOptions(cards);
    const metadata: WhatsappSessionCardMetadata = { cardOptions: options };
    const who =
      `${connection.receiver.firstName} ${connection.receiver.lastName}`.trim() ||
      "Your connection";

    await this.prisma.whatsappSession.create({
      data: {
        userId: requesterUserId,
        phoneE164: e164FromStoredUser(connection.requester),
        state: WhatsappFlowState.AWAITING_REQUESTER_CARD_SELECTION,
        connectionId,
        metadata,
        expiresAt: connectionSessionExpiresAt(),
      },
    });

    const prompt = formatCardSelectionMessage(
      `${who} accepted and shared their ${recipientCardName} card. Which card would you like to share back?`,
      options,
    );
    await this.messaging.sendText({
      toE164: e164FromStoredUser(connection.requester),
      text: prompt,
      purpose: WhatsappMessagePurpose.CARD_SELECTION,
      correlationId: connectionId,
    });

    return options;
  }

  async sendCompletionMessages(connectionId: string): Promise<void> {
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId },
      include: {
        requester: true,
        receiver: true,
        requesterSharedCard: true,
        receiverSharedCard: true,
      },
    });
    if (!connection || connection.status !== ConnectionStatus.ACCEPTED) {
      return;
    }

    const requesterName =
      `${connection.requester.firstName} ${connection.requester.lastName}`.trim() ||
      "Your connection";
    const receiverName =
      `${connection.receiver.firstName} ${connection.receiver.lastName}`.trim() ||
      "Your connection";

    await this.messaging.sendText({
      toE164: e164FromStoredUser(connection.requester),
      text: `ContactBook: You are now connected with ${receiverName}. Both cards were shared.`,
      purpose: WhatsappMessagePurpose.CONNECTION_UPDATE,
      correlationId: connectionId,
    });
    await this.messaging.sendText({
      toE164: e164FromStoredUser(connection.receiver),
      text: `ContactBook: You are now connected with ${requesterName}. Both cards were shared.`,
      purpose: WhatsappMessagePurpose.CONNECTION_UPDATE,
      correlationId: connectionId,
    });
  }

  private async clearConnectionSessions(connectionId: string): Promise<void> {
    await this.prisma.whatsappSession.updateMany({
      where: { connectionId },
      data: { state: WhatsappFlowState.IDLE },
    });
  }
}
