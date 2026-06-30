import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WhatsappMessagePurpose } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  composeE164,
  e164FromStoredUser,
  inboundE164ToIdentity,
} from "../common/phone.util";
import { WhatsappMessagingService } from "../messaging/whatsapp-messaging.service";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_POC_RECIPIENTS = "+919587746347,+31627452799,+919347243575";

@Injectable()
export class LoginBroadcastService {
  private readonly logger = new Logger(LoginBroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: WhatsappMessagingService,
    private readonly config: ConfigService,
  ) {}

  async sendForUser(userId: string): Promise<void> {
    if (
      this.config.get<string>("LOGIN_BROADCAST_ENABLED", "false") !== "true"
    ) {
      return;
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          countryCode: true,
          phone: true,
          email: true,
        },
      });
      if (!user) return;

      const name = `${user.firstName} ${user.lastName}`.trim();
      const text = renderLoginBroadcast({
        name,
        phone: e164FromStoredUser(user),
        email: user.email,
      });
      const correlationId = `login-broadcast:${user.id}:${randomUUID()}`;
      const results = await Promise.allSettled(
        this.recipients().map((toE164) =>
          this.messaging.sendText({
            toE164,
            text,
            purpose: WhatsappMessagePurpose.LOGIN_BROADCAST,
            correlationId,
          }),
        ),
      );
      const failed = results.filter(
        (result) => result.status === "rejected",
      ).length;
      if (failed > 0) {
        this.logger.warn(`Login broadcast failed for ${failed} recipient(s)`);
      }
    } catch {
      this.logger.warn("Login broadcast could not be prepared");
    }
  }

  private recipients(): string[] {
    const configured = this.config.get<string>(
      "LOGIN_BROADCAST_RECIPIENTS",
      DEFAULT_POC_RECIPIENTS,
    );
    return [...new Set(configured.split(",").map(normalizeRecipient))];
  }
}

function normalizeRecipient(value: string): string {
  const identity = inboundE164ToIdentity(value.trim());
  if (!identity) throw new Error("Invalid login broadcast recipient");
  return composeE164(identity.countryCode, identity.phone);
}

function renderLoginBroadcast(input: {
  name: string;
  phone: string;
  email: string;
}): string {
  return (
    `${input.name} is on ContactBook. You get started by visiting https://www.getcontactbook.com and creating your account.\n\n` +
    `Here is ${input.name}'s Contact card.\n\n` +
    `Name: ${input.name}\n` +
    `Phone no: ${input.phone}\n` +
    `Email: ${input.email}`
  );
}
