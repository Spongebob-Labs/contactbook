import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OAuthProvider } from "@prisma/client";
import { e164FromStoredUser } from "../common/phone.util";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleService } from "../integration/google.service";
import { TwilioService } from "../integration/twilio.service";

@Injectable()
export class TravelCronService {
  private readonly logger = new Logger(TravelCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleService,
    private readonly twilio: TwilioService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async pollCalendar(): Promise<void> {
    const accounts = await this.prisma.oAuthAccount.findMany({
      where: { provider: OAuthProvider.GOOGLE },
    });
    for (const account of accounts) {
      try {
        await this.google.syncTravelEvents(account.userId);
        await this.notifyPendingTravel(account.userId);
      } catch (error) {
        this.logger.warn(
          `Travel poll failed for user ${account.userId}: ${String(error)}`,
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
      await this.twilio.sendWhatsApp(
        e164FromStoredUser(user),
        `ContactBook travel: ${event.title ?? "Trip"} — ${where || "your calendar"}.`,
      );
      await this.prisma.travelEvent.update({
        where: { id: event.id },
        data: { whatsappSentAt: new Date() },
      });
    }
  }
}
