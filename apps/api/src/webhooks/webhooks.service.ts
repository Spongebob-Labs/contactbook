import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { maskPhone } from '../common/logging/redact';
import { BotService } from './bot.service';
import type { InboundMessageResponseDto } from './dto/inbound-message-response.dto';
import type { ListInboundMessagesQueryDto } from './dto/list-inbound-messages-query.dto';

const DEFAULT_LIMIT = 100;

/** Twilio's inbound webhook body, as parsed from application/x-www-form-urlencoded.
 *  Only the fields this service actually reads — the full payload is kept
 *  verbatim in `rawPayload` regardless of what's typed here. */
interface TwilioInboundParams {
  MessageSid?: string;
  From?: string;
  To?: string;
  Body?: string;
  ProfileName?: string;
  [key: string]: unknown;
}

function stripWhatsappPrefix(value: string | undefined): string {
  return (value ?? '').replace(/^whatsapp:/, '');
}

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    private readonly bot: BotService,
  ) {}

  /**
   * Records one inbound webhook hit, verbatim. Deduped on the
   * `(fromPhoneE164, toPhoneE164)` pair, not on Twilio's MessageSid — this
   * table is a "have these two ever connected" log, one row per pair EVER,
   * not one row per message. Both a Twilio retry of a delivery already
   * recorded, and a genuinely new second message from an already-logged
   * sender, hit the same unique constraint and are treated identically: a
   * no-op, not an error. From the caller's perspective (the controller,
   * which must always answer 2xx so Twilio stops retrying) this is exactly
   * as done as a fresh insert either way.
   */
  async recordInbound(params: TwilioInboundParams): Promise<void> {
    const providerMessageId = params.MessageSid;
    if (!providerMessageId) {
      // No SID at all means this isn't a real Twilio message webhook — log
      // and drop rather than throw, since throwing here would make Twilio
      // retry a payload that will never gain a SID on retry either.
      this.logger.error('webhooks.inbound_missing_sid', {});
      return;
    }

    const fromPhoneE164 = stripWhatsappPrefix(params.From);
    const toPhoneE164 = stripWhatsappPrefix(params.To);

    try {
      await this.prisma.inboundMessage.create({
        data: {
          source: 'WHATSAPP_MESSAGE',
          providerMessageId,
          fromPhoneE164,
          toPhoneE164,
          body: params.Body ?? null,
          profileName: params.ProfileName ?? null,
          rawPayload: params as Prisma.InputJsonValue,
          resolvedOwnerId: null,
        },
      });
      this.logger.info('webhooks.inbound_recorded', {
        fromPhoneE164: maskPhone(fromPhoneE164),
        providerMessageId,
      });
    } catch (err) {
      // P2002 on (fromPhoneE164, toPhoneE164) = this pair is already on
      // file — either a Twilio retry of a delivery we already recorded, or a
      // genuinely new message from a sender we've logged before. Not an
      // error — same outcome as if this were the first time.
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      ) {
        this.logger.info('webhooks.inbound_duplicate_ignored', {
          providerMessageId,
        });
      } else {
        throw err;
      }
    }

    // Fire bot reply after recording (or on duplicate — the bot must respond
    // to every real message, not just the first one from a given sender).
    // Async fire-and-forget: a bot failure must never cause Twilio to retry.
    void this.bot
      .handleInbound(fromPhoneE164, params.Body ?? null)
      .catch((err: unknown) => {
        this.logger.error('bot.unhandled_error', {
          fromPhone: maskPhone(fromPhoneE164),
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  async list(
    query: ListInboundMessagesQueryDto,
  ): Promise<InboundMessageResponseDto[]> {
    const rows = await this.prisma.inboundMessage.findMany({
      where: {
        ...(query.fromPhoneE164 && { fromPhoneE164: query.fromPhoneE164 }),
        ...(query.source && { source: query.source }),
      },
      orderBy: { receivedAt: 'desc' },
      take: query.limit ?? DEFAULT_LIMIT,
    });

    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      provider: row.provider,
      providerMessageId: row.providerMessageId,
      fromPhoneE164: row.fromPhoneE164,
      toPhoneE164: row.toPhoneE164,
      body: row.body,
      profileName: row.profileName,
      resolvedOwnerId: row.resolvedOwnerId,
      receivedAt: row.receivedAt,
    }));
  }
}
