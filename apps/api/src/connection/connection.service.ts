import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Connection,
  ConnectionStatus,
  WhatsappFlowState,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TwilioService } from "../integration/twilio.service";
import { CreateConnectionRequestDto } from "./dto/create-connection-request.dto";

@Injectable()
export class ConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioService,
  ) {}

  async createRequest(
    initiatorId: string,
    dto: CreateConnectionRequestDto,
  ): Promise<Connection> {
    const initiator = await this.prisma.user.findUnique({
      where: { id: initiatorId },
    });
    if (
      initiator &&
      initiator.email.toLowerCase() === dto.recipientEmail.toLowerCase()
    ) {
      throw new BadRequestException("Cannot connect to yourself");
    }
    const recipient = await this.prisma.user.findUnique({
      where: { email: dto.recipientEmail.toLowerCase() },
    });
    if (!recipient) {
      throw new NotFoundException("Recipient not found");
    }
    if (!recipient.phone) {
      throw new BadRequestException("Recipient must have a phone number");
    }
    const card = await this.prisma.contactCard.findFirst({
      where: { id: dto.initiatorSharedCardId, userId: initiatorId },
    });
    if (!card) {
      throw new ForbiddenException("Card not found for initiator");
    }
    const shareExpiresAt = dto.shareExpiresAt
      ? new Date(dto.shareExpiresAt)
      : null;
    const connection = await this.prisma.connection.create({
      data: {
        initiatorId,
        recipientId: recipient.id,
        status: ConnectionStatus.PENDING,
        initiatorSharedCardId: dto.initiatorSharedCardId,
        shareExpiresAt,
      },
    });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.whatsappSession.create({
      data: {
        userId: recipient.id,
        phoneE164: recipient.phone,
        state: WhatsappFlowState.AWAITING_CONNECTION_ACCEPT,
        connectionId: connection.id,
        expiresAt,
      },
    });
    await this.twilio.sendWhatsApp(
      recipient.phone,
      `ContactBook: ${initiator?.name ?? initiator?.email ?? "Someone"} wants to connect. Reply ACCEPT-${connection.id} or DECLINE-${connection.id}.`,
    );
    return connection;
  }

  async accept(connectionId: string, userId: string): Promise<Connection> {
    await this.requireRecipient(connectionId, userId);
    return this.prisma.connection.update({
      where: { id: connectionId },
      data: {
        status: ConnectionStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });
  }

  async decline(connectionId: string, userId: string): Promise<Connection> {
    await this.requireRecipient(connectionId, userId);
    return this.prisma.connection.update({
      where: { id: connectionId },
      data: { status: ConnectionStatus.DECLINED },
    });
  }

  async shareBack(
    connectionId: string,
    userId: string,
    recipientSharedCardId: string,
  ): Promise<Connection> {
    const c = await this.prisma.connection.findFirst({
      where: {
        id: connectionId,
        recipientId: userId,
        status: ConnectionStatus.ACCEPTED,
      },
    });
    if (!c) {
      throw new NotFoundException("Connection not found");
    }
    const card = await this.prisma.contactCard.findFirst({
      where: { id: recipientSharedCardId, userId },
    });
    if (!card) {
      throw new ForbiddenException("Card not found");
    }
    return this.prisma.connection.update({
      where: { id: connectionId },
      data: { recipientSharedCardId },
    });
  }

  async listForUser(userId: string): Promise<Connection[]> {
    return this.prisma.connection.findMany({
      where: {
        OR: [{ initiatorId: userId }, { recipientId: userId }],
      },
      orderBy: { createdAt: "desc" },
    });
  }

  private async requireRecipient(
    connectionId: string,
    userId: string,
  ): Promise<Connection> {
    const c = await this.prisma.connection.findFirst({
      where: {
        id: connectionId,
        recipientId: userId,
        status: ConnectionStatus.PENDING,
      },
    });
    if (!c) {
      throw new NotFoundException("Pending connection not found");
    }
    return c;
  }
}
