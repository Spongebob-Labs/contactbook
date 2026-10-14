import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { maskPhone } from '../common/logging/redact';
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
  /// Quick-reply button taps: the label the user tapped (e.g. "✅ Approve").
  /// Freeform messages leave this undefined. The agent's approval-resume
  /// path uses this to distinguish a button decision from a freeform reply.
  ButtonText?: string;
  [key: string]: unknown;
}

function stripWhatsappPrefix(value: string | undefined): string {
  return (value ?? '').replace(/^whatsapp:/, '');
}

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly logger: AppLogger,
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
      await this.prisma.$transaction(async (tx) => {
        // Best-effort InboundMessage insert. P2002 on the
        // (fromPhoneE164, toPhoneE164) unique constraint means the
        // pair is already on file — first contact ever, not this
        // specific message. Swallow that one; let any other DB
        // error propagate.
        try {
          await tx.inboundMessage.create({
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
        } catch (err) {
          if (
            err &&
            typeof err === 'object' &&
            'code' in err &&
            (err as { code?: string }).code === 'P2002'
          ) {
            // Pair already logged. Fall through to the agent
            // enqueue below — the new message still needs to be
            // processed even if the (sender, business) pair was
            // first logged on an earlier delivery.
            return;
          }
          throw err;
        }

        // Enqueue the agent processing. dedupeKey is the Twilio
        // MessageSid so a Twilio retry of the same delivery hits
        // the outbox unique constraint and is silently dropped
        // (the original enqueue already covers it). A genuinely
        // new message has a new SID → new dedupeKey → enqueued.
        await this.outbox.enqueue(tx, {
          dedupeKey: `agent_inbound:${providerMessageId}`,
          kind: 'agent_process_inbound',
          payload: {
            inboundMessageId: providerMessageId, // best-effort; the row is uniquely keyed by SID
            fromPhoneE164,
            toPhoneE164,
            body: params.Body ?? null,
            buttonText: params.ButtonText ?? null,
            profileName: params.ProfileName ?? null,
          },
        });
      });

      this.logger.info('webhooks.inbound_recorded', {
        fromPhoneE164: maskPhone(fromPhoneE164),
        providerMessageId,
      });
    } catch (err) {
      // P2002 on the outbox dedupeKey = Twilio retried a delivery
      // we already enqueued. Same outcome as a fresh enqueue.
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      ) {
        this.logger.info('webhooks.inbound_duplicate_ignored', {
          providerMessageId,
        });
        return;
      }
      throw err;
    }
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
