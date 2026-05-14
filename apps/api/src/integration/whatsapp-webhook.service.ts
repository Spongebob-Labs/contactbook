import { Injectable, Logger } from "@nestjs/common";
import {
  type User,
  ConnectionStatus,
  FieldAccessRequestStatus,
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

  async handleInboundMessage(fromRaw: string, body: string): Promise<void> {
    const from = fromRaw.replace(/^whatsapp:/, "");
    const text = (body ?? "").trim();

    const sfrApprove = /^APPROVE-SFR-([0-9a-f-]{36})$/i.exec(text);
    const sfrDecline = /^DECLINE-SFR-([0-9a-f-]{36})$/i.exec(text);
    if (sfrApprove) {
      await this.resolveSensitiveRequest(sfrApprove[1], "APPROVED", from);
      return;
    }
    if (sfrDecline) {
      await this.resolveSensitiveRequest(sfrDecline[1], "DENIED", from);
      return;
    }

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

  private async resolveSensitiveRequest(
    id: string,
    status: "APPROVED" | "DENIED",
    fromPhone: string,
  ): Promise<void> {
    const user = await this.findUserFromInboundE164(fromPhone);
    if (!user) {
      await this.twilio.sendWhatsApp(
        fromPhone,
        "ContactBook: that request is no longer pending.",
      );
      return;
    }
    const req = await this.prisma.sensitiveFieldAccessRequest.findFirst({
      where: {
        id,
        ownerId: user.id,
        status: FieldAccessRequestStatus.PENDING,
      },
    });
    if (!req) {
      await this.twilio.sendWhatsApp(
        fromPhone,
        "ContactBook: that request is no longer pending.",
      );
      return;
    }
    await this.prisma.sensitiveFieldAccessRequest.update({
      where: { id },
      data: {
        status:
          status === "APPROVED"
            ? FieldAccessRequestStatus.APPROVED
            : FieldAccessRequestStatus.DENIED,
        resolvedAt: new Date(),
      },
    });
    await this.prisma.whatsappSession.updateMany({
      where: {
        phoneE164: fromPhone,
        state: WhatsappFlowState.AWAITING_SENSITIVE_FIELD_APPROVAL,
      },
      data: { state: WhatsappFlowState.IDLE },
    });
    await this.twilio.sendWhatsApp(
      fromPhone,
      `ContactBook: access request ${status.toLowerCase()}.`,
    );
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
        recipientId: user.id,
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
      data: {
        status: ConnectionStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });
    await this.prisma.whatsappSession.updateMany({
      where: {
        phoneE164: fromPhone,
        state: WhatsappFlowState.AWAITING_CONNECTION_ACCEPT,
      },
      data: { state: WhatsappFlowState.IDLE },
    });
    const initiator = await this.prisma.user.findUnique({
      where: { id: connection.initiatorId },
    });
    await this.twilio.sendWhatsApp(
      fromPhone,
      "ContactBook: you accepted the connection.",
    );
    if (initiator?.phone) {
      await this.twilio.sendWhatsApp(
        e164FromStoredUser(initiator),
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
        recipientId: user.id,
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
        phoneE164: fromPhone,
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
