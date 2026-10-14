import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AppLogger } from '../../common/logging/app-logger.service';
import { OutboxService } from '../../outbox/outbox.service';
import { ReminderService } from './reminder.service';
import { Reminder } from '@prisma/client';
import { nanoid } from 'nanoid';

/**
 * The per-minute cron that fires due reminders.
 *
 * The codebase invariant (CLAUDE.md §"Non-negotiables" #4) says every
 * `@Cron` takes a Postgres advisory lock — a deploy briefly runs two
 * containers, and overlapping tickers must not double-dispatch. We
 * honour that here with pg_try_advisory_lock keyed on a stable int
 * derived from this dispatcher's name. The lock is released at the
 * end of the tick.
 *
 * Each tick: claim up to 100 due reminders (FOR UPDATE SKIP LOCKED,
 * inside a tx), and enqueue one `send_whatsapp_reminder` outbox row
 * per reminder. The existing OutboxDispatchService + the registered
 * handler in AgentModule do the actual Twilio send.
 */
@Injectable()
export class ReminderDispatcherService
  implements OnModuleInit, OnModuleDestroy
{
  // Stable advisory-lock key, computed once. Any 64-bit int works; we
  // derive from a hash of the name so the lock is unique to this cron
  // and won't collide with any future advisory lock in the app.
  private static readonly LOCK_KEY = BigInt(
    // FNV-1a 32-bit hash of "reminders.tick" → fits in int8.
    (() => {
      let h = 0x811c9dc5;
      for (const ch of 'reminders.tick') {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 0x01000193);
      }
      return h >>> 0;
    })(),
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly reminders: ReminderService,
    private readonly outbox: OutboxService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit(): void {
    this.logger.info('reminders.dispatcher_ready', {});
  }

  onModuleDestroy(): void {
    // @nestjs/schedule owns the cron lifecycle; nothing to clean up.
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'reminders.tick' })
  async tick(): Promise<void> {
    const acquired = await this.tryAcquireLock();
    if (!acquired) {
      // Another instance holds the lock this minute. Normal during deploy.
      this.logger.debug('reminders.tick_lock_busy', {});
      return;
    }

    try {
      const due = await this.reminders.claimDue(100);
      if (due.length === 0) return;

      this.logger.info('reminders.tick_due', { count: due.length });

      for (const r of due) {
        await this.enqueueOne(r);
      }
    } catch (err) {
      this.logger.error('reminders.tick_failed', {
        err: err instanceof Error ? err.message : String(err),
      });
    } finally {
      await this.releaseLock();
    }
  }

  private async enqueueOne(r: Reminder): Promise<void> {
    // The user is the recipient — they set the reminder for themselves.
    // The handler resolves phoneE164 from r.userId at dispatch time.
    const dedupeKey = `reminder:${r.id}`;
    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enqueue(tx, {
        dedupeKey,
        kind: 'send_whatsapp_reminder',
        payload: {
          reminderId: r.id,
          userId: r.userId,
          text: r.text,
          correlationId: r.id, // ties the Message row to the Reminder
        },
      });
      // Pin the outboxId on the reminder for traceability.
      const outboxRow = await tx.outboxMessage.findUnique({
        where: { dedupeKey },
      });
      if (outboxRow) {
        await tx.reminder.update({
          where: { id: r.id },
          data: { outboxId: outboxRow.id },
        });
      }
    });
  }

  private async tryAcquireLock(): Promise<boolean> {
    // session-level lock, scoped to this connection. The pg adapter
    // gives each Prisma query its own connection from the pool, so
    // we run the lock on a dedicated client to keep the session
    // binding consistent across the tick.
    const result = await this.prisma.$queryRaw<{ acquired: boolean }[]>`
      SELECT pg_try_advisory_lock(${ReminderDispatcherService.LOCK_KEY}) AS acquired
    `;
    return result[0]?.acquired === true;
  }

  private async releaseLock(): Promise<void> {
    await this.prisma.$queryRaw`
      SELECT pg_advisory_unlock(${ReminderDispatcherService.LOCK_KEY})
    `;
  }
}
