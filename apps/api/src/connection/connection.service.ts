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
import {
  e164FromStoredUser,
  normalizeDialCode,
  normalizeNationalPhone,
} from "../common/phone.util";
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
    requesterId: string,
    dto: CreateConnectionRequestDto,
  ): Promise<Connection> {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });
    const recipientDial = normalizeDialCode(dto.recipientCountryCode);
    const recipientPhone = normalizeNationalPhone(dto.recipientPhone);
    if (
      requester &&
      requester.countryCode === recipientDial &&
      requester.phone === recipientPhone
    ) {
      throw new BadRequestException("Cannot connect to yourself");
    }
    const recipient = await this.prisma.user.findUnique({
      where: {
        countryCode_phone: {
          countryCode: recipientDial,
          phone: recipientPhone,
        },
      },
    });
    if (!recipient) {
      throw new NotFoundException("Recipient not found for this phone number");
    }
    const card = await this.prisma.contactCard.findFirst({
      where: { id: dto.sharedCardId, userId: requesterId },
    });
    if (!card) {
      throw new ForbiddenException("Card not found for requester");
    }
    const connection = await this.prisma.connection.create({
      data: {
        requesterId,
        receiverId: recipient.id,
        status: ConnectionStatus.PENDING,
        sharedCardId: dto.sharedCardId,
      },
    });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.whatsappSession.create({
      data: {
        userId: recipient.id,
        phoneE164: e164FromStoredUser(recipient),
        state: WhatsappFlowState.AWAITING_CONNECTION_ACCEPT,
        connectionId: connection.id,
        expiresAt,
      },
    });
    const who = requester
      ? `${requester.firstName} ${requester.lastName}`.trim()
      : "Someone";
    await this.twilio.sendConnectionInvite(
      e164FromStoredUser(recipient),
      who || requester?.email || "Someone",
      connection.id,
    );
    return connection;
  }

  async accept(connectionId: string, userId: string): Promise<Connection> {
    await this.requireReceiver(connectionId, userId);
    return this.prisma.connection.update({
      where: { id: connectionId },
      data: { status: ConnectionStatus.ACCEPTED },
    });
  }

  async decline(connectionId: string, userId: string): Promise<Connection> {
    await this.requireReceiver(connectionId, userId);
    return this.prisma.connection.update({
      where: { id: connectionId },
      data: { status: ConnectionStatus.DECLINED },
    });
  }

  async shareBack(connectionId: string, userId: string): Promise<Connection> {
    const c = await this.prisma.connection.findFirst({
      where: {
        id: connectionId,
        receiverId: userId,
        status: ConnectionStatus.ACCEPTED,
      },
    });
    if (!c) {
      throw new NotFoundException("Connection not found");
    }
    return this.prisma.connection.update({
      where: { id: connectionId },
      data: { hasSharedBack: true },
    });
  }

  async listForUser(userId: string): Promise<Connection[]> {
    return this.prisma.connection.findMany({
      where: {
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: "desc" },
    });
  }

  private async requireReceiver(
    connectionId: string,
    userId: string,
  ): Promise<Connection> {
    const c = await this.prisma.connection.findFirst({
      where: {
        id: connectionId,
        receiverId: userId,
        status: ConnectionStatus.PENDING,
      },
    });
    if (!c) {
      throw new NotFoundException("Pending connection not found");
    }
    return c;
  }
}
