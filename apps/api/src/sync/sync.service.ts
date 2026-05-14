import { Injectable, Logger } from "@nestjs/common";
import { ConnectionStatus } from "@prisma/client";
import { e164FromStoredUser } from "../common/phone.util";
import { PrismaService } from "../prisma/prisma.service";
import { TwilioService } from "../integration/twilio.service";

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioService,
  ) {}

  /** Notify connections that reference this profile field via a mapped card. */
  async notifyFieldSubscribers(fieldId: string): Promise<void> {
    const mappings = await this.prisma.cardFieldMapping.findMany({
      where: { fieldId },
      select: { cardId: true },
    });
    const seen = new Set<string>();
    for (const m of mappings) {
      if (!seen.has(m.cardId)) {
        seen.add(m.cardId);
        await this.notifyCardSubscribers(m.cardId);
      }
    }
  }

  async notifyCardSubscribers(contactCardId: string): Promise<void> {
    const connections = await this.prisma.connection.findMany({
      where: {
        status: ConnectionStatus.ACCEPTED,
        sharedCardId: contactCardId,
      },
      include: { requester: true, receiver: true },
    });
    for (const c of connections) {
      try {
        if (c.sharedCardId === contactCardId && c.receiver.phone) {
          const who = `${c.requester.firstName} ${c.requester.lastName}`.trim();
          await this.twilio.sendWhatsApp(
            e164FromStoredUser(c.receiver),
            `ContactBook: ${who || "Your connection"} updated a shared contact card.`,
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
