import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { WebhookDlqStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappWebhookService } from "./whatsapp-webhook.service";
import type { WhatsappInboundEvent } from "../messaging/whatsapp-provider";
import { WhatsappMessagingService } from "../messaging/whatsapp-messaging.service";

type OpenWaDlqPayload = WhatsappInboundEvent & { ledgerId: string };

/** Maximum number of delivery attempts before a record is permanently marked FAILED. */
const MAX_ATTEMPTS = 5;

/**
 * Returns the delay in minutes before the next retry using exponential backoff:
 *   attempt 1 → 1 min, 2 → 2 min, 3 → 4 min, 4 → 8 min, 5 → 16 min
 */
function backoffMinutes(attempt: number): number {
  return Math.pow(2, attempt - 1);
}

@Injectable()
export class WebhookDlqService {
  private readonly logger = new Logger(WebhookDlqService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookService: WhatsappWebhookService,
    private readonly messaging: WhatsappMessagingService,
  ) {}

  async enqueueOpenWa(
    event: WhatsappInboundEvent,
    ledgerId: string,
    headers: Record<string, string>,
    webhookUrl: string,
  ): Promise<void> {
    await this.prisma.webhookDeadLetter.create({
      data: {
        source: "openwa_whatsapp",
        payload: { ...event, ledgerId },
        headers,
        webhookUrl,
        status: WebhookDlqStatus.PENDING,
        nextRetryAt: null,
      },
    });
    this.logger.warn(
      `OpenWA webhook enqueued to DLQ. Message=${event.providerMessageId}`,
    );
  }

  /**
   * Cron: runs every 5 minutes. Picks up PENDING / RETRYING records whose
   * nextRetryAt is in the past (or null) and attempts to replay them.
   */
  @Cron("*/5 * * * *")
  async retryPending(): Promise<void> {
    const now = new Date();
    const records = await this.prisma.webhookDeadLetter.findMany({
      where: {
        status: { in: [WebhookDlqStatus.PENDING, WebhookDlqStatus.RETRYING] },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: { createdAt: "asc" },
      take: 20, // process in small batches to avoid long cron runs
    });

    if (records.length === 0) return;

    this.logger.log(`DLQ retry: processing ${records.length} record(s)`);

    for (const record of records) {
      // Mark as RETRYING immediately to prevent concurrent cron overlap
      await this.prisma.webhookDeadLetter.update({
        where: { id: record.id },
        data: { status: WebhookDlqStatus.RETRYING },
      });

      try {
        const event = record.payload as unknown as OpenWaDlqPayload;
        await this.webhookService.handleInboundMessage(
          event.fromE164,
          event.text,
          event.location,
        );
        await this.messaging.markInboundProcessed(event.ledgerId);

        await this.prisma.webhookDeadLetter.update({
          where: { id: record.id },
          data: {
            status: WebhookDlqStatus.SUCCEEDED,
            resolvedAt: new Date(),
            lastError: null,
          },
        });

        this.logger.log(`DLQ record ${record.id} succeeded on retry`);
      } catch (err: unknown) {
        const newAttempts = record.attempts + 1;
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (newAttempts >= MAX_ATTEMPTS) {
          await this.prisma.webhookDeadLetter.update({
            where: { id: record.id },
            data: {
              status: WebhookDlqStatus.FAILED,
              attempts: newAttempts,
              lastError: errorMessage,
              nextRetryAt: null,
            },
          });
          this.logger.error(
            `DLQ record ${record.id} permanently FAILED after ${newAttempts} attempts. ` +
              `Message=${(record.payload as unknown as WhatsappInboundEvent).providerMessageId ?? "unknown"} ` +
              `Error=${errorMessage}`,
          );
        } else {
          const delay = backoffMinutes(newAttempts);
          const nextRetryAt = new Date(Date.now() + delay * 60 * 1000);
          await this.prisma.webhookDeadLetter.update({
            where: { id: record.id },
            data: {
              status: WebhookDlqStatus.PENDING,
              attempts: newAttempts,
              lastError: errorMessage,
              nextRetryAt,
            },
          });
          this.logger.warn(
            `DLQ record ${record.id} failed attempt ${newAttempts}/${MAX_ATTEMPTS}. ` +
              `Next retry in ${delay} min. Error=${errorMessage}`,
          );
        }
      }
    }
  }
}
