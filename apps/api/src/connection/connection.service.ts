import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ConnectionInviteRecipientKind,
  ConnectionInviteStatus,
  ConnectionStatus,
  WhatsappFlowState,
  type Connection,
  type ConnectionInvite,
} from "@prisma/client";
import {
  e164FromStoredUser,
  inboundE164ToIdentity,
  normalizeDialCode,
  normalizeNationalPhone,
} from "../common/phone.util";
import { PrismaService } from "../prisma/prisma.service";
import { TwilioService } from "../integration/twilio.service";
import { ConnectionInviteService } from "./connection-invite.service";
import { connectionSessionExpiresAt } from "./connection-flow.types";
import { CreateConnectionRequestDto } from "./dto/create-connection-request.dto";

export type CreateConnectionResult =
  | { type: "connection"; connection: Connection }
  | { type: "invite"; invite: ConnectionInvite };

@Injectable()
export class ConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioService,
    private readonly invites: ConnectionInviteService,
  ) {}

  async createRequest(
    requesterId: string,
    dto: CreateConnectionRequestDto,
  ): Promise<CreateConnectionResult> {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });
    if (!requester) {
      throw new BadRequestException("User not found");
    }

    const cardCount = await this.prisma.contactCard.count({
      where: { userId: requesterId },
    });
    if (cardCount === 0) {
      throw new BadRequestException(
        "Complete your profile and create at least one card before sending connection requests",
      );
    }

    let recipientDial: string;
    let recipientPhone: string;
    let recipientContactId: string | null = null;

    if (dto.recipientContactId) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: dto.recipientContactId, userId: requesterId },
        include: {
          phones: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
        },
      });
      if (!contact) {
        throw new NotFoundException("Contact not found");
      }
      const primaryPhone =
        contact.phones.find((p) => p.isPrimary) ?? contact.phones[0];
      if (!primaryPhone?.value) {
        throw new BadRequestException(
          "Contact has no phone number for connection invite",
        );
      }
      const parsed = this.parsePhoneValue(primaryPhone.value);
      recipientDial = parsed.countryCode;
      recipientPhone = parsed.phone;
      recipientContactId = contact.id;
    } else if (dto.recipientPhone && dto.recipientCountryCode) {
      recipientDial = normalizeDialCode(dto.recipientCountryCode);
      recipientPhone = normalizeNationalPhone(dto.recipientPhone);
    } else {
      throw new BadRequestException(
        "Provide recipientContactId or recipientPhone with recipientCountryCode",
      );
    }

    if (
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

    const who =
      `${requester.firstName} ${requester.lastName}`.trim() ||
      requester.email ||
      "Someone";

    if (!recipient) {
      let kind = recipientContactId
        ? ConnectionInviteRecipientKind.CONTACT
        : ConnectionInviteRecipientKind.EXTERNAL;

      if (!recipientContactId) {
        const matchedContact = await this.findContactByPhone(
          requesterId,
          recipientDial,
          recipientPhone,
        );
        if (matchedContact) {
          kind = ConnectionInviteRecipientKind.CONTACT;
          recipientContactId = matchedContact.id;
        }
      }

      const existingInvite = await this.prisma.connectionInvite.findFirst({
        where: {
          requesterId,
          recipientCountryCode: recipientDial,
          recipientPhone,
          status: ConnectionInviteStatus.PENDING,
        },
      });
      if (existingInvite) {
        throw new ConflictException(
          "An invite is already pending for this phone number",
        );
      }

      const invite = await this.invites.createInvite({
        requesterId,
        requesterDisplayName: who,
        recipientKind: kind,
        recipientContactId,
        recipientCountryCode: recipientDial,
        recipientPhone,
      });
      return { type: "invite", invite };
    }

    const existing = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId, receiverId: recipient.id },
          { requesterId: recipient.id, receiverId: requesterId },
        ],
      },
    });

    if (existing) {
      if (existing.status === ConnectionStatus.ACCEPTED) {
        throw new ConflictException("You are already connected with this user");
      }
      if (existing.status === ConnectionStatus.PENDING) {
        throw new ConflictException(
          "A connection request is already pending with this user",
        );
      }
      if (existing.status === ConnectionStatus.DECLINED) {
        const connection = await this.prisma.connection.update({
          where: { id: existing.id },
          data: {
            status: ConnectionStatus.PENDING,
            requesterId,
            receiverId: recipient.id,
            requesterSharedCardId: null,
            receiverSharedCardId: null,
            hasSharedBack: false,
          },
        });
        await this.setupRecipientSessionAndInvite(connection, recipient, who);
        return { type: "connection", connection };
      }
    }

    const connection = await this.prisma.connection.create({
      data: {
        requesterId,
        receiverId: recipient.id,
        status: ConnectionStatus.PENDING,
      },
    });

    await this.setupRecipientSessionAndInvite(connection, recipient, who);
    return { type: "connection", connection };
  }

  private async setupRecipientSessionAndInvite(
    connection: Connection,
    recipient: { id: string; countryCode: string; phone: string },
    requesterDisplayName: string,
  ): Promise<void> {
    await this.prisma.whatsappSession.updateMany({
      where: {
        userId: recipient.id,
        state: WhatsappFlowState.AWAITING_CONNECTION_ACCEPT,
        expiresAt: { gt: new Date() },
      },
      data: { state: WhatsappFlowState.IDLE },
    });

    await this.prisma.whatsappSession.create({
      data: {
        userId: recipient.id,
        phoneE164: e164FromStoredUser(recipient),
        state: WhatsappFlowState.AWAITING_CONNECTION_ACCEPT,
        connectionId: connection.id,
        expiresAt: connectionSessionExpiresAt(),
      },
    });

    await this.twilio.sendConnectionInvite(
      e164FromStoredUser(recipient),
      requesterDisplayName,
      connection.id,
    );
  }

  private parsePhoneValue(value: string): {
    countryCode: string;
    phone: string;
  } {
    const trimmed = value.trim();
    const e164 = trimmed.startsWith("+")
      ? trimmed
      : `+${trimmed.replace(/\D/g, "")}`;
    const identity = inboundE164ToIdentity(e164);
    if (!identity) {
      throw new BadRequestException(
        "Contact phone must be a valid international number",
      );
    }
    return identity;
  }

  async listForUser(userId: string): Promise<Connection[]> {
    return this.prisma.connection.findMany({
      where: {
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async assertWhatsAppOnlyCompletion(): Promise<never> {
    throw new ConflictException(
      "Connection requests are completed via WhatsApp only. Use Accept/Decline and card selection in WhatsApp.",
    );
  }

  private async findContactByPhone(
    userId: string,
    countryCode: string,
    phone: string,
  ): Promise<{ id: string } | null> {
    const contacts = await this.prisma.contact.findMany({
      where: { userId, deletedAt: null },
      include: { phones: true },
      take: 500,
    });
    for (const c of contacts) {
      for (const p of c.phones) {
        try {
          const identity = this.parsePhoneValue(p.value);
          if (
            identity.countryCode === countryCode &&
            identity.phone === phone
          ) {
            return { id: c.id };
          }
        } catch {
          if (p.value.replace(/\D/g, "") === phone.replace(/\D/g, "")) {
            return { id: c.id };
          }
        }
      }
    }
    return null;
  }
}
