import { Injectable, Logger } from "@nestjs/common";
import {
  type User,
  ConnectionStatus,
  WhatsappFlowState,
} from "@prisma/client";
import { e164FromStoredUser, inboundE164ToIdentity } from "../common/phone.util";
import { PrismaService } from "../prisma/prisma.service";
import { TwilioService } from "./twilio.service";

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioService,
  ) {}

  /**
   * Handles inbound WhatsApp messages. `inboundText` should prefer `ButtonText`
   * (interactive replies) when present, then `Body`.
   */
  async handleInboundMessage(
    fromRaw: string,
    inboundText: string,
  ): Promise<void> {
    const from = fromRaw.replace(/^whatsapp:/, "");
    const text = (inboundText ?? "").trim();

    const accept = /^ACCEPT-([0-9a-f-]{36})$/i.exec(text);
    const decline = /^DECLINE-([0-9a-f-]{36})$/i.exec(text);
    if (accept) {
      await this.acceptConnection(accept[1], from);
      return;
    }
    if (decline) {
      await this.declineConnection(decline[1], from);
      return;
    }

    const quickAccept = /^accept$/i.exec(text);
    const quickDecline = /^decline$/i.exec(text);
    if (quickAccept || quickDecline) {
      await this.resolveLatestPendingConnection(from, quickAccept !== null);
      return;
    }

    this.logger.log(`Unhandled WhatsApp message from ${from}: ${text}`);
  }

  private async findUserFromInboundE164(e164: string): Promise<User | null> {
    const keys = inboundE164ToIdentity(e164);
    if (!keys) {
      return null;
    }
    return this.prisma.user.findUnique({
      where: { countryCode_phone: keys },
    });
  }

  private async resolveLatestPendingConnection(
    fromPhone: string,
    accept: boolean,
  ): Promise<void> {
    const user = await this.findUserFromInboundE164(fromPhone);
    if (!user) {
      return;
    }
    const session = await this.prisma.whatsappSession.findFirst({
      where: {
        phoneE164: e164FromStoredUser(user),
        state: WhatsappFlowState.AWAITING_CONNECTION_ACCEPT,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!session?.connectionId) {
      await this.twilio.sendWhatsApp(
        fromPhone,
        "ContactBook: no pending connection invite found. Use the message that contained Accept/Decline.",
      );
      return;
    }
    if (accept) {
      await this.acceptConnection(session.connectionId, fromPhone);
    } else {
      await this.declineConnection(session.connectionId, fromPhone);
    }
  }

  private async acceptConnection(
    connectionId: string,
    fromPhone: string,
  ): Promise<void> {
    const user = await this.findUserFromInboundE164(fromPhone);
    if (!user) {
      await this.twilio.sendWhatsApp(
        fromPhone,
        "ContactBook: no pending request found for that code.",
      );
      return;
    }
    const connection = await this.prisma.connection.findFirst({
      where: {
        id: connectionId,
        receiverId: user.id,
        status: ConnectionStatus.PENDING,
      },
    });
    if (!connection) {
      await this.twilio.sendWhatsApp(
        fromPhone,
        "ContactBook: no pending request found for that code.",
      );
      return;
    }
    await this.prisma.connection.update({
      where: { id: connectionId },
      data: { status: ConnectionStatus.ACCEPTED },
    });
    await this.prisma.whatsappSession.updateMany({
      where: {
        connectionId,
        state: WhatsappFlowState.AWAITING_CONNECTION_ACCEPT,
      },
      data: { state: WhatsappFlowState.IDLE },
    });
    const requester = await this.prisma.user.findUnique({
      where: { id: connection.requesterId },
    });
    await this.twilio.sendWhatsApp(
      fromPhone,
      "ContactBook: you accepted the connection.",
    );
    if (requester) {
      await this.twilio.sendWhatsApp(
        e164FromStoredUser(requester),
        "ContactBook: your connection request was accepted.",
      );
    }
  }

  private async declineConnection(
    connectionId: string,
    fromPhone: string,
  ): Promise<void> {
    const user = await this.findUserFromInboundE164(fromPhone);
    if (!user) {
      await this.twilio.sendWhatsApp(
        fromPhone,
        "ContactBook: no pending request found for that code.",
      );
      return;
    }
    const connection = await this.prisma.connection.findFirst({
      where: {
        id: connectionId,
        receiverId: user.id,
        status: ConnectionStatus.PENDING,
      },
    });
    if (!connection) {
      await this.twilio.sendWhatsApp(
        fromPhone,
        "ContactBook: no pending request found for that code.",
      );
      return;
    }
    await this.prisma.connection.update({
      where: { id: connectionId },
      data: { status: ConnectionStatus.DECLINED },
    });
    await this.prisma.whatsappSession.updateMany({
      where: {
        connectionId,
        state: WhatsappFlowState.AWAITING_CONNECTION_ACCEPT,
      },
      data: { state: WhatsappFlowState.IDLE },
    });
    await this.twilio.sendWhatsApp(
      fromPhone,
      "ContactBook: you declined the connection.",
    );
  }
}
