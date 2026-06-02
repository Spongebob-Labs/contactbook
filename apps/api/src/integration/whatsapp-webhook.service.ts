import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { type User, ConnectionStatus, WhatsappFlowState } from "@prisma/client";
import {
  e164FromStoredUser,
  inboundE164ToIdentity,
} from "../common/phone.util";
import { PrismaService } from "../prisma/prisma.service";
import { resolveCardIdFromInbound } from "../connection/connection-card-prompt.util";
import { ConnectionShareService } from "../connection/connection-share.service";
import type { WhatsappSessionCardMetadata } from "../connection/connection-flow.types";
import { TwilioService } from "./twilio.service";

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioService,
    private readonly connectionShare: ConnectionShareService,
  ) {}

  /**
   * Handles inbound WhatsApp messages. `inboundText` should prefer `ButtonText`
   * (interactive replies) when present, then `Body`.
   */
  async handleInboundMessage(
    fromRaw: string,
    inboundText: string,
    options?: { latitude?: number; longitude?: number },
  ): Promise<void> {
    const from = fromRaw.replace(/^whatsapp:/, "");
    const text = (inboundText ?? "").trim();

    if (
      options?.latitude != null &&
      options?.longitude != null &&
      Number.isFinite(options.latitude) &&
      Number.isFinite(options.longitude)
    ) {
      await this.handleLocationShare(from, options.latitude, options.longitude);
      return;
    }

    const user = await this.findUserFromInboundE164(from);
    if (user) {
      const handled = await this.handleActiveSession(user, from, text);
      if (handled) {
        return;
      }
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

    const quickAccept = /^accept$/i.exec(text);
    const quickDecline = /^decline$/i.exec(text);
    if (quickAccept || quickDecline) {
      await this.resolveLatestPendingConnection(from, quickAccept !== null);
      return;
    }

    this.logger.log(`Unhandled WhatsApp message from ${from}: ${text}`);
  }

  private async handleActiveSession(
    user: User,
    fromPhone: string,
    text: string,
  ): Promise<boolean> {
    const session = await this.prisma.whatsappSession.findFirst({
      where: {
        phoneE164: e164FromStoredUser(user),
        expiresAt: { gt: new Date() },
        state: {
          in: [
            WhatsappFlowState.AWAITING_RECIPIENT_CARD_SELECTION,
            WhatsappFlowState.AWAITING_REQUESTER_CARD_SELECTION,
          ],
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!session?.connectionId) {
      return false;
    }

    const metadata = session.metadata as WhatsappSessionCardMetadata | null;
    const options = metadata?.cardOptions ?? [];
    const cardId = resolveCardIdFromInbound(text, options);
    if (!cardId) {
      await this.twilio.sendWhatsApp(
        fromPhone,
        `ContactBook: Please reply with a number between 1 and ${options.length}, or the card name.`,
      );
      return true;
    }

    if (session.state === WhatsappFlowState.AWAITING_RECIPIENT_CARD_SELECTION) {
      await this.handleRecipientCardPick(
        session.connectionId,
        user.id,
        fromPhone,
        cardId,
        options,
      );
      return true;
    }

    if (session.state === WhatsappFlowState.AWAITING_REQUESTER_CARD_SELECTION) {
      await this.handleRequesterCardPick(
        session.connectionId,
        user.id,
        fromPhone,
        cardId,
      );
      return true;
    }

    return false;
  }

  private async handleRecipientCardPick(
    connectionId: string,
    receiverUserId: string,
    fromPhone: string,
    cardId: string,
    options: { id: string; name: string }[],
  ): Promise<void> {
    try {
      const result = await this.connectionShare.shareCard(
        connectionId,
        receiverUserId,
        cardId,
        "recipient",
      );
      const cardName =
        options.find((o) => o.id === cardId)?.name ?? result.sharedCard.name;

      await this.twilio.sendWhatsApp(
        fromPhone,
        `ContactBook: You shared your ${cardName} card.`,
      );

      if (!result.completed) {
        const connection = await this.prisma.connection.findUniqueOrThrow({
          where: { id: connectionId },
        });
        await this.connectionShare.beginRequesterCardSelection(
          connectionId,
          connection.requesterId,
          cardName,
        );
      }
    } catch (err) {
      await this.sendShareError(fromPhone, err);
    }
  }

  private async handleRequesterCardPick(
    connectionId: string,
    requesterUserId: string,
    fromPhone: string,
    cardId: string,
  ): Promise<void> {
    try {
      const result = await this.connectionShare.shareCard(
        connectionId,
        requesterUserId,
        cardId,
        "requester",
      );
      if (result.completed) {
        await this.connectionShare.sendCompletionMessages(connectionId);
      } else {
        await this.twilio.sendWhatsApp(
          fromPhone,
          "ContactBook: Your card was shared.",
        );
      }
    } catch (err) {
      await this.sendShareError(fromPhone, err);
    }
  }

  private async sendShareError(fromPhone: string, err: unknown): Promise<void> {
    const message =
      err instanceof BadRequestException || err instanceof Error
        ? err.message
        : "Could not complete card share.";
    await this.twilio.sendWhatsApp(fromPhone, `ContactBook: ${message}`);
  }

  private async handleLocationShare(
    fromPhone: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const user = await this.findUserFromInboundE164(fromPhone);
    if (!user) {
      return;
    }
    const profile = await this.prisma.userTravelProfile.findUnique({
      where: { userId: user.id },
    });
    const away =
      profile?.homeCity != null ? latitude !== 0 || longitude !== 0 : true;
    await this.prisma.userTravelSession.create({
      data: {
        userId: user.id,
        inTravel: away,
        detectedCity: `${latitude.toFixed(2)},${longitude.toFixed(2)}`,
        promptedAt: new Date(),
      },
    });
    if (away) {
      await this.twilio.sendWhatsApp(
        fromPhone,
        "ContactBook: It looks like you may be traveling. Reply NOTIFY to alert your travel contact list.",
      );
    }
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

    const cardCount = await this.prisma.contactCard.count({
      where: { userId: user.id },
    });
    if (cardCount === 0) {
      await this.twilio.sendWhatsApp(
        fromPhone,
        "ContactBook: Complete your profile and create a card in ContactBook before accepting connections.",
      );
      return;
    }

    try {
      await this.connectionShare.beginRecipientCardSelection(
        connectionId,
        user.id,
      );
    } catch (err) {
      await this.sendShareError(fromPhone, err);
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
      include: { requester: true },
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
      where: { connectionId },
      data: { state: WhatsappFlowState.IDLE },
    });
    await this.twilio.sendWhatsApp(
      fromPhone,
      "ContactBook: you declined the connection.",
    );
    const who = `${user.firstName} ${user.lastName}`.trim() || "Someone";
    await this.twilio.sendWhatsApp(
      e164FromStoredUser(connection.requester),
      `ContactBook: ${who} declined your connection request. No contact details were shared.`,
    );
  }
}
