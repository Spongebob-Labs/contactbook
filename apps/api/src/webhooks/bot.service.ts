import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { TwilioClient } from '../messaging/twilio-client';
import { AppConfigService } from '../config/app-config.service';
import { maskPhone } from '../common/logging/redact';

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CardSelectionContext {
  ownerId: string;
  cards: Array<{ index: number; id: string; name: string }>;
}

function isCardSelectionContext(v: unknown): v is CardSelectionContext {
  return (
    !!v &&
    typeof v === 'object' &&
    'ownerId' in v &&
    'cards' in v &&
    Array.isArray((v as CardSelectionContext).cards)
  );
}

/**
 * Stateful WhatsApp bot. One BotSession row per sender phone, updated
 * in-place. Session expires after SESSION_TTL_MS of inactivity; an expired
 * session is treated as if it doesn't exist (restart the flow from scratch).
 *
 * Replies are free-form text, valid because we're always replying within
 * the 24-hour window opened by the user's own inbound message.
 */
@Injectable()
export class BotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioClient,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {}

  async handleInbound(fromPhone: string, body: string | null): Promise<void> {
    if (!this.twilio.isConfigured()) {
      this.logger.warn('bot.twilio_not_configured', {
        fromPhone: maskPhone(fromPhone),
      });
      return;
    }

    const text = (body ?? '').trim();
    const session = await this.getActiveSession(fromPhone);

    if (session?.state === 'AWAITING_CARD_SELECTION') {
      await this.handleCardSelection(fromPhone, text, session.context);
      return;
    }

    // No active session — start the flow
    await this.startFlow(fromPhone, text);
  }

  private async startFlow(fromPhone: string, _text: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { phoneE164: fromPhone },
      select: { id: true, firstName: true },
    });

    if (!user) {
      await this.reply(
        fromPhone,
        `Welcome to ContactBook! Create your profile at ${this.config.shareBaseUrl}`,
      );
      return;
    }

    const cards = await this.prisma.card.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
    });

    if (cards.length === 0) {
      await this.reply(
        fromPhone,
        `Hi ${user.firstName ?? 'there'}! You don't have any cards yet. Create one at ${this.config.shareBaseUrl}`,
      );
      return;
    }

    const cardList = cards
      .map((c, i) => `${i + 1}. ${c.name}`)
      .join('\n');

    await this.reply(
      fromPhone,
      `Hi ${user.firstName ?? 'there'}! Which card would you like to share?\n\n${cardList}\n\nReply with a number.`,
    );

    await this.upsertSession(fromPhone, 'AWAITING_CARD_SELECTION', {
      ownerId: user.id,
      cards: cards.map((c, i) => ({ index: i + 1, id: c.id, name: c.name })),
    });
  }

  private async handleCardSelection(
    fromPhone: string,
    text: string,
    rawContext: unknown,
  ): Promise<void> {
    if (!isCardSelectionContext(rawContext)) {
      await this.clearSession(fromPhone);
      await this.startFlow(fromPhone, text);
      return;
    }

    const ctx = rawContext;
    const choice = parseInt(text, 10);

    if (isNaN(choice) || choice < 1 || choice > ctx.cards.length) {
      const cardList = ctx.cards.map((c) => `${c.index}. ${c.name}`).join('\n');
      await this.reply(
        fromPhone,
        `Please reply with a number between 1 and ${ctx.cards.length}:\n\n${cardList}`,
      );
      // Extend session TTL on re-prompt
      await this.upsertSession(fromPhone, 'AWAITING_CARD_SELECTION', ctx);
      return;
    }

    const selected = ctx.cards.find((c) => c.index === choice);
    if (!selected) {
      await this.clearSession(fromPhone);
      await this.startFlow(fromPhone, text);
      return;
    }

    // Build the share URL using the card's publicToken
    const card = await this.prisma.card.findFirst({
      where: { id: selected.id, userId: ctx.ownerId },
      select: { publicToken: true, name: true },
    });

    await this.clearSession(fromPhone);

    if (!card?.publicToken) {
      await this.reply(
        fromPhone,
        `Sorry, that card doesn't have a public link yet. Open the app to set one up.`,
      );
      return;
    }

    const url = `${this.config.shareBaseUrl}/c/${card.publicToken}`;
    await this.reply(
      fromPhone,
      `Here's your *${card.name}* card:\n${url}`,
    );

    this.logger.info('bot.card_link_sent', {
      fromPhone: maskPhone(fromPhone),
      cardId: selected.id,
    });
  }

  private async reply(toPhone: string, text: string): Promise<void> {
    try {
      await this.twilio.sendFreeform({ toE164: toPhone, body: text });
    } catch (err) {
      this.logger.error('bot.reply_failed', {
        toPhone: maskPhone(toPhone),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async getActiveSession(phoneE164: string) {
    const session = await this.prisma.botSession.findUnique({
      where: { phoneE164 },
    });
    if (!session || session.expiresAt < new Date()) {
      return null;
    }
    return session;
  }

  private async upsertSession(
    phoneE164: string,
    state: 'AWAITING_CARD_SELECTION',
    context: CardSelectionContext,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const ctx = context as unknown as Prisma.InputJsonValue;
    await this.prisma.botSession.upsert({
      where: { phoneE164 },
      create: { phoneE164, state, context: ctx, expiresAt },
      update: { state, context: ctx, expiresAt },
    });
  }

  private async clearSession(phoneE164: string): Promise<void> {
    await this.prisma.botSession
      .delete({ where: { phoneE164 } })
      .catch(() => {
        // Already gone — fine
      });
  }
}
