import { Injectable } from "@nestjs/common";
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
import { TwilioService } from "../integration/twilio.service";
import { connectionSessionExpiresAt } from "./connection-flow.types";

@Injectable()
export class ConnectionInviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioService,
  ) {}

  async createInvite(params: {
    requesterId: string;
    requesterDisplayName: string;
    recipientKind: ConnectionInviteRecipientKind;
    recipientContactId?: string | null;
    recipientCountryCode: string;
    recipientPhone: string;
  }): Promise<ConnectionInvite> {
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

    await this.twilio.sendConnectionSignupInvite(
      composeE164(dial, phone),
      params.requesterDisplayName,
    );

    return invite;
  }
}
