import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  CardShareDispatchStatus,
  WhatsappMessagePurpose,
  WhatsappProvider as WhatsappProviderName,
  WhatsappTemplateApprovalStatus,
  WhatsappTemplateSyncStatus,
  type Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappMessagingService } from "../messaging/whatsapp-messaging.service";
import { composeE164 } from "../common/phone.util";
import { TwilioCardShareProvider } from "./twilio-card-share.provider";

const BATCH_SIZE = 25;
const MAX_DISPATCH_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 30 * 60_000;

function backoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS);
}

type DueRecipient = Prisma.CardShareRecipientGetPayload<{
  include: {
    batch: {
      include: { template: true; vcardAsset: true; sender: true };
    };
  };
}>;

@Injectable()
export class CardShareDispatchService {
  private readonly logger = new Logger(CardShareDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: WhatsappMessagingService,
    private readonly twilio: TwilioCardShareProvider,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async run(): Promise<void> {
    const due = await this.prisma.cardShareRecipient.findMany({
      where: {
        dispatchStatus: {
          in: [
            CardShareDispatchStatus.PENDING,
            CardShareDispatchStatus.RETRYING,
          ],
        },
        nextAttemptAt: { lte: new Date() },
      },
      take: BATCH_SIZE,
      include: {
        batch: {
          include: { template: true, vcardAsset: true, sender: true },
        },
      },
    });

    for (const recipient of due) {
      await this.dispatchOne(recipient);
    }
  }

  private async dispatchOne(recipient: DueRecipient): Promise<void> {
    // A template can die between batch creation and dispatch (deactivated by an admin,
    // deleted on Twilio, approval revoked). Fail the recipient terminally instead of
    // burning retries against a dead ContentSid — resend works if it's later restored.
    const template = recipient.batch.template;
    if (
      !template.isActive ||
      template.approvalStatus !== WhatsappTemplateApprovalStatus.APPROVED ||
      template.syncStatus === WhatsappTemplateSyncStatus.MISSING_ON_TWILIO
    ) {
      await this.prisma.cardShareRecipient.update({
        where: { id: recipient.id },
        data: {
          dispatchStatus: CardShareDispatchStatus.FAILED,
          lastDispatchError: `Template "${template.key}" is no longer available`,
        },
      });
      return;
    }

    try {
      const toE164 = composeE164(
        recipient.recipientCountryCode,
        recipient.recipientPhone,
      );
      const senderDisplayName =
        `${recipient.batch.sender.firstName} ${recipient.batch.sender.lastName}`.trim();

      const delivery = await this.messaging.sendTrackedWithProvider(
        toE164,
        WhatsappMessagePurpose.CARD_SHARE,
        recipient.id,
        WhatsappProviderName.TWILIO,
        () =>
          this.twilio.send({
            toE164,
            contentSid: recipient.batch.template.contentSid,
            senderDisplayName,
            cardName: recipient.batch.cardNameSnapshot,
            note: recipient.batch.note,
            vcardObjectKey: recipient.batch.vcardAsset.objectKey,
          }),
      );

      await this.prisma.cardShareRecipient.update({
        where: { id: recipient.id },
        data: {
          dispatchStatus: CardShareDispatchStatus.DISPATCHED,
          whatsappMessageId: delivery.ledgerId,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      await this.recordFailure(recipient.id, recipient.dispatchAttempts, error);
    }
  }

  private async recordFailure(
    recipientId: string,
    priorAttempts: number,
    error: unknown,
  ): Promise<void> {
    const attempts = priorAttempts + 1;
    const message = error instanceof Error ? error.message : String(error);
    const terminal = attempts >= MAX_DISPATCH_ATTEMPTS;

    this.logger.warn(
      `Card-share dispatch failed for recipient=${recipientId} attempt=${attempts}: ${message}`,
    );

    await this.prisma.cardShareRecipient.update({
      where: { id: recipientId },
      data: {
        dispatchAttempts: attempts,
        dispatchStatus: terminal
          ? CardShareDispatchStatus.FAILED
          : CardShareDispatchStatus.RETRYING,
        nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
        lastDispatchError: message,
      },
    });
  }
}
