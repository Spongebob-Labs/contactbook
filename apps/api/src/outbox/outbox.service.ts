import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

// Via the Prisma namespace's own re-export, not a runtime-internal deep import
// — the latter's path (`@prisma/client/runtime/library`) moved between
// Prisma 6 and 7, breaking silently at the type level. Prisma.InputJsonValue
// is the stable, documented surface.

export interface EnqueueInput {
  dedupeKey: string;
  kind: string;
  payload: Record<string, unknown>;
}

/**
 * Writes ONLY. Call this inside the same transaction as the domain change it
 * accompanies (e.g. the OtpChallenge insert) — that is what makes an enqueue
 * impossible to lose or duplicate. Never call Twilio (or anything outbound)
 * from here or from the caller; dispatch happens later, out of the request path.
 */
@Injectable()
export class OutboxService {
  async enqueue(tx: Prisma.TransactionClient, input: EnqueueInput) {
    return tx.outboxMessage.create({
      data: {
        dedupeKey: input.dedupeKey,
        kind: input.kind,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
  }
}
