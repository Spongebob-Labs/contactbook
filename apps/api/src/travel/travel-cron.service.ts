import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { e164FromStoredUser } from "../common/phone.util";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleService } from "../integration/google.service";
import { OAuthTokenService } from "../oauth-tokens/oauth-token.service";
import { WhatsappMessagingService } from "../messaging/whatsapp-messaging.service";
import { WhatsappMessagePurpose } from "@prisma/client";

const GOOGLE_PROVIDER = "google";

@Injectable()
export class TravelCronService {
  private readonly logger = new Logger(TravelCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleService,
    private readonly oauthTokenService: OAuthTokenService,
    private readonly messaging: WhatsappMessagingService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async pollCalendar(): Promise<void> {
    const userIds =
      await this.oauthTokenService.findUserIdsByProvider(GOOGLE_PROVIDER);
    for (const userId of userIds) {
      try {
        await this.google.syncTravelEvents(userId);
        await this.notifyPendingTravel(userId);
      } catch (error) {
        this.logger.warn(
          `Travel poll failed for user ${userId}: ${String(error)}`,
        );
      }
    }
  }

  private async notifyPendingTravel(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phone) {
      return;
    }
    const pending = await this.prisma.travelEvent.findMany({
      where: {
        userId,
        whatsappSentAt: null,
        startDate: { gte: new Date() },
      },
    });
    for (const event of pending) {
      const where = `${event.city}, ${event.country}`.trim();
      const travelerMessage = `Upcoming travel: ${where} (${event.startDate.toISOString().slice(0, 10)}). Reply NOTIFY to alert your travel contacts.`;
      await this.messaging.sendText({
        toE164: e164FromStoredUser(user),
        text: travelerMessage,
        purpose: WhatsappMessagePurpose.TRAVEL_NOTIFICATION,
        correlationId: event.id,
      });
      await this.prisma.travelEvent.update({
        where: { id: event.id },
        data: { whatsappSentAt: new Date() },
      });
    }
  }
}
