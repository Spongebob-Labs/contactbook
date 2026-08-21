import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { TaskHandlerRegistry } from './task-handler.registry';

/**
 * Claims and processes exactly one outbox row. Shared by both transports:
 * the inline path calls this directly; the Cloud Tasks HTTP handler calls
 * this from inside the OIDC-guarded controller. Either way the claim is
 * atomic, so a duplicate delivery (Cloud Tasks retry, or two inline calls
 * racing) is a no-op rather than a double send.
 */
@Injectable()
export class OutboxDispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: TaskHandlerRegistry,
    private readonly logger: AppLogger,
  ) {}

  async dispatch(outboxId: string): Promise<void> {
    const claimed = await this.prisma.$queryRaw<
      { id: string; kind: string; payload: unknown }[]
    >`
      UPDATE outbox_messages
      SET status = 'CLAIMED', "claimedAt" = NOW(), attempts = attempts + 1
      WHERE id = ${outboxId} AND status IN ('PENDING', 'DEFERRED')
      RETURNING id, kind, payload
    `;

    if (claimed.length === 0) {
      // Already claimed/sent/failed by another invocation. Normal on a Cloud
      // Tasks retry — not an error.
      this.logger.debug('outbox.claim_missed', { outboxId });
      return;
    }

    const row = claimed[0];
    const handler = this.registry.get(row.kind);

    if (!handler) {
      await this.prisma.outboxMessage.update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          lastError: `No handler for kind "${row.kind}"`,
          completedAt: new Date(),
        },
      });
      this.logger.error('outbox.no_handler', { outboxId, kind: row.kind });
      return;
    }

    try {
      await handler(row.payload as Record<string, unknown>);
      await this.prisma.outboxMessage.update({
        where: { id: row.id },
        // Scrub the payload on success: it may have carried a plaintext OTP
        // code that only ever existed to make this one send possible.
        data: {
          status: 'SENT',
          completedAt: new Date(),
          payload: { scrubbed: true },
        },
      });
      this.logger.info('outbox.sent', { outboxId, kind: row.kind });
    } catch (err) {
      await this.prisma.outboxMessage.update({
        where: { id: row.id },
        data: {
          status: 'PENDING',
          lastError: err instanceof Error ? err.message : String(err),
        },
      });
      this.logger.warn('outbox.dispatch_failed', {
        outboxId,
        kind: row.kind,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
