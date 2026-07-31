import { Injectable, Logger } from "@nestjs/common";
import { CardShareDispatchStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { inboundE164ToIdentity } from "../common/phone.util";
import { TwilioCardShareProvider } from "./twilio-card-share.provider";

/**
 * Handles the second leg of the two-message WhatsApp card-share flow.
 *
 * Flow:
 *   1. Sender dispatches a quick-reply template to a recipient.
 *   2. Recipient taps "Get Contact" → WhatsApp sends a message to our number, opening a
 *      24-hour session window.
 *   3. Twilio fires a webhook to TwilioIncomingMessageController, which calls handleQuickReply().
 *   4. We locate the pending CardShareRecipient, atomically claim it, and send the VCF
 *      document so the recipient sees a native "Add to Contacts" button in WhatsApp.
 *
 * Idempotency: vcfSentAt is set before the Twilio call in an updateMany WHERE vcfSentAt IS
 * NULL.  If the webhook fires twice (Twilio retry on timeout), the second attempt finds 0
 * rows to update and exits early — the VCF is never sent twice.
 */
@Injectable()
export class CardShareVcfReplyService {
  private readonly logger = new Logger(CardShareVcfReplyService.name);

  // 23 h — 1 h inside the WhatsApp 24-hour session window to avoid boundary-condition races.
  private static readonly SESSION_WINDOW_MS = 23 * 60 * 60 * 1_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioCardShareProvider,
  ) {}

  async handleQuickReply(fromE164: string): Promise<void> {
    const identity = inboundE164ToIdentity(fromE164);
    if (!identity) {
      this.logger.warn(
        `handleQuickReply: cannot parse incoming E.164 "${fromE164}" — ignoring.`,
      );
      return;
    }

    const windowStart = new Date(
      Date.now() - CardShareVcfReplyService.SESSION_WINDOW_MS,
    );

    // Most recent dispatched template send where the VCF follow-up hasn't gone out yet.
    const candidate = await this.prisma.cardShareRecipient.findFirst({
      where: {
        recipientCountryCode: identity.countryCode,
        recipientPhone: identity.phone,
        dispatchStatus: CardShareDispatchStatus.DISPATCHED,
        vcfSentAt: null,
        sentAt: { gte: windowStart },
      },
      orderBy: { sentAt: "desc" },
      include: {
        batch: { include: { vcardAsset: true } },
      },
    });

    if (!candidate) {
      this.logger.debug(
        `handleQuickReply: no pending VCF for ${fromE164} — message ignored.`,
      );
      return;
    }

    // Atomic claim — prevents a duplicate send if Twilio retries the webhook.
    const claimed = await this.prisma.cardShareRecipient.updateMany({
      where: { id: candidate.id, vcfSentAt: null },
      data: { vcfSentAt: new Date() },
    });

    if (claimed.count === 0) {
      this.logger.debug(
        `handleQuickReply: recipient=${candidate.id} already claimed — skipping.`,
      );
      return;
    }

    try {
      const vcfSid = await this.twilio.sendVcfDocument({
        toE164: fromE164,
        vcfUrl: candidate.batch.vcardAsset.storageUrl,
      });

      await this.prisma.cardShareRecipient.update({
        where: { id: candidate.id },
        data: { vcfMessageSid: vcfSid },
      });

      this.logger.log(
        `VCF document sent: recipient=${candidate.id} to=${fromE164} sid=${vcfSid}`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `VCF document send failed: recipient=${candidate.id} to=${fromE164} — ${msg}`,
        error instanceof Error ? error.stack : undefined,
      );
      // vcfSentAt is left set so we don't re-send on a future quick-reply tap. An operator
      // can clear it manually in the DB to allow a retry if needed.
    }
  }
}
