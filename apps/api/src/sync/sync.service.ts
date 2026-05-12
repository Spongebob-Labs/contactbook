import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TwilioService } from "../integration/twilio.service";

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioService,
  ) {}

  async notifyCardSubscribers(contactCardId: string): Promise<void> {
    const connections = await this.prisma.connection.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { initiatorSharedCardId: contactCardId },
          { recipientSharedCardId: contactCardId },
        ],
      },
      include: { initiator: true, recipient: true },
    });
    for (const c of connections) {
      try {
        if (c.initiatorSharedCardId === contactCardId && c.recipient.phone) {
          await this.twilio.sendWhatsApp(
            c.recipient.phone,
            `ContactBook: ${c.initiator.name ?? "Your connection"} updated a shared contact card.`,
          );
        }
        if (c.recipientSharedCardId === contactCardId && c.initiator.phone) {
          await this.twilio.sendWhatsApp(
            c.initiator.phone,
            `ContactBook: ${c.recipient.name ?? "Your connection"} updated a shared contact card.`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Notify failed for connection ${c.id}: ${String(err)}`,
        );
      }
    }
  }
}
