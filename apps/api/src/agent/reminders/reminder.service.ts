import { Injectable } from '@nestjs/common';
import { Reminder, ReminderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiError } from '../../common/errors/api-error';

/**
 * CRUD for the Reminder table. Used by the agent tools (set/list/cancel)
 * and by the cron dispatcher (claim/sent/fail).
 */
@Injectable()
export class ReminderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a PENDING reminder. The agent's `set_reminder` tool calls this
   * AFTER the human approves the action (HITL lives in the tool, not here).
   */
  async create(
    userId: string,
    input: { text: string; scheduledFor: Date },
  ): Promise<Reminder> {
    if (input.text.length < 1 || input.text.length > 500) {
      throw ApiError.badRequest(
        'REMINDER_TEXT_INVALID',
        'Reminder text must be 1..500 chars.',
      );
    }
    const now = new Date();
    if (input.scheduledFor.getTime() <= now.getTime()) {
      throw ApiError.badRequest(
        'REMINDER_IN_PAST',
        'scheduledFor must be in the future.',
      );
    }
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    if (input.scheduledFor.getTime() - now.getTime() > oneYear) {
      throw ApiError.badRequest(
        'REMINDER_TOO_FAR',
        'Reminders can be at most 1 year in the future.',
      );
    }
    return this.prisma.reminder.create({
      data: {
        userId,
        text: input.text,
        scheduledFor: input.scheduledFor,
        status: ReminderStatus.PENDING,
      },
    });
  }

  /** List a user's upcoming (PENDING) reminders, soonest first, max 20. */
  async listActive(userId: string): Promise<Reminder[]> {
    return this.prisma.reminder.findMany({
      where: { userId, status: ReminderStatus.PENDING },
      orderBy: { scheduledFor: 'asc' },
      take: 20,
    });
  }

  /**
   * Get one reminder, asserting the caller owns it. IDOR-safe.
   */
  async getOwned(userId: string, reminderId: string): Promise<Reminder> {
    const r = await this.prisma.reminder.findFirst({
      where: { id: reminderId, userId },
    });
    if (!r) {
      throw ApiError.notFound(
        'REMINDER_NOT_FOUND',
        'No reminder with that id for this user.',
      );
    }
    return r;
  }

  /**
   * Cancel a PENDING reminder. The agent's `cancel_reminder` tool calls
   * this AFTER the human approves.
   */
  async cancel(userId: string, reminderId: string): Promise<Reminder> {
    const r = await this.getOwned(userId, reminderId);
    if (r.status !== ReminderStatus.PENDING) {
      throw ApiError.conflict(
        'REMINDER_NOT_CANCELLABLE',
        `Reminder is ${r.status.toLowerCase()}; only PENDING reminders can be cancelled.`,
      );
    }
    return this.prisma.reminder.update({
      where: { id: r.id },
      data: { status: ReminderStatus.CANCELLED },
    });
  }

  // -----------------------------------------------------------------------
  // Cron-dispatcher helpers (called by ReminderDispatcherService only).
  // -----------------------------------------------------------------------

  /**
   * Atomically claim up to `limit` PENDING reminders whose `scheduledFor`
   * is in the past. SELECT ... FOR UPDATE SKIP LOCKED is the canonical
   * Postgres pattern for "many workers, each grabs a different row" —
   * safe under the brief two-container overlap during deploy.
   *
   * Returns the claimed rows (now status='CLAIMED') so the dispatcher
   * can enqueue one outbox row per reminder.
   */
  async claimDue(limit = 100): Promise<Reminder[]> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM reminders
        WHERE status = 'PENDING' AND "scheduledFor" <= NOW()
        ORDER BY "scheduledFor" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `;
      if (claimed.length === 0) return [];
      const ids = claimed.map((r) => r.id);
      await tx.$executeRaw`
        UPDATE reminders
        SET status = 'CLAIMED', "updatedAt" = NOW()
        WHERE id IN (${Prisma.join(ids)})
      `;
      return tx.reminder.findMany({ where: { id: { in: ids } } });
    });
  }

  async markSent(
    id: string,
    twilioMessageId: string | null,
    outboxId: string | null,
  ): Promise<void> {
    await this.prisma.reminder.update({
      where: { id },
      data: {
        status: ReminderStatus.SENT,
        sentAt: new Date(),
        twilioMessageId,
        outboxId,
        errorMessage: null,
      },
    });
  }

  /**
   * On dispatch failure, push the reminder back to PENDING so the
   * next minute's tick retries it. (v1: retries forever; a per-
   * reminder attempts cap is a Phase 4 concern.)
   */
  async markRetry(id: string, errorMessage: string): Promise<void> {
    await this.prisma.reminder.update({
      where: { id },
      data: { status: ReminderStatus.PENDING, errorMessage },
    });
  }
}
