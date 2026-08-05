import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ConnectionInviteRecipientKind,
  ConnectionInviteStatus,
  type ConnectionInvite,
} from "@prisma/client";
import {
  composeE164,
  normalizeDialCode,
  normalizeNationalPhone,
} from "../common/phone.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  WhatsappMessagingService,
  type WhatsappDelivery,
} from "../messaging/whatsapp-messaging.service";
import { connectionSessionExpiresAt } from "./connection-flow.types";

@Injectable()
export class ConnectionInviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: WhatsappMessagingService,
    private readonly config: ConfigService,
  ) {}

  async createInvite(params: {
    requesterId: string;
    requesterDisplayName: string;
    recipientKind: ConnectionInviteRecipientKind;
    recipientContactId?: string | null;
    recipientCountryCode: string;
    recipientPhone: string;
  }): Promise<{ invite: ConnectionInvite; delivery: WhatsappDelivery }> {
    const dial = normalizeDialCode(params.recipientCountryCode);
    const phone = normalizeNationalPhone(params.recipientPhone);

    const invite = await this.prisma.connectionInvite.create({
      data: {
        requesterId: params.requesterId,
        recipientKind: params.recipientKind,
        recipientContactId: params.recipientContactId ?? null,
        recipientCountryCode: dial,
        recipientPhone: phone,
        status: ConnectionInviteStatus.PENDING,
        expiresAt: connectionSessionExpiresAt(),
      },
    });

    const delivery = await this.sendSignupInvite(
      invite,
      params.requesterDisplayName,
    );
    return { invite, delivery };
  }

  async resendInvite(
    requesterId: string,
    inviteId: string,
  ): Promise<WhatsappDelivery> {
    const invite = await this.prisma.connectionInvite.findFirst({
      where: {
        id: inviteId,
        requesterId,
        status: ConnectionInviteStatus.PENDING,
      },
      include: { requester: true },
    });
    if (!invite) {
      throw new NotFoundException("Pending connection request not found");
    }
    const who =
      `${invite.requester.firstName} ${invite.requester.lastName}`.trim() ||
      invite.requester.email ||
      "Someone";
    return this.sendSignupInvite(invite, who);
  }

  private sendSignupInvite(
    invite: Pick<
      ConnectionInvite,
      "id" | "recipientCountryCode" | "recipientPhone"
    >,
    requesterDisplayName: string,
  ): Promise<WhatsappDelivery> {
    const webApp = this.config
      .get<string>("WEB_APP_URL", "https://contactbook.app")
      .replace(/\/$/, "");
    return this.messaging.sendConnectionInvite({
      toE164: composeE164(invite.recipientCountryCode, invite.recipientPhone),
      requesterDisplayName,
      signupUrl: webApp,
      correlationId: invite.id,
    });
  }
}
