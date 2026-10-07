import { CardsService } from './cards.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AppConfigService } from '../config/app-config.service';
import type { AppLogger } from '../common/logging/app-logger.service';
import { OutboxService } from '../outbox/outbox.service';
import type { TaskEnqueuer } from '../outbox/task-enqueuer';
import type { CardLogoStorageService } from './card-logo-storage.service';
import type { CardCoverStorageService } from './card-cover-storage.service';

/**
 * `google_wallet_push` — written in the SAME transaction as the card change,
 * next to Apple's `wallet_push`, and handed to the transport only after that
 * transaction has committed. CardsService never calls Google itself.
 *
 * The real OutboxService runs against a transaction double that records every
 * write in order, so "same transaction" is asserted, not assumed: the outbox
 * row is created through the `tx` client, never through `prisma` directly.
 */

const UPDATED_AT = new Date('2026-10-07T10:00:00.000Z');
const NOW = new Date('2026-10-07T12:00:00.000Z');

const cardRow = {
  id: 'card-1',
  userId: 'user-1',
  name: 'Work',
  kind: 'CUSTOM',
  archivedAt: null,
  publicToken: 'tok3nPublic',
  logoUrl: null,
  coverUrl: null,
  headline: 'Head of Design',
  bio: null,
  templateId: 'meridian',
  paletteId: null,
  groundHex: null,
  finish: null,
  texture: null,
  texturePresence: null,
  textureScale: null,
  createdAt: UPDATED_AT,
  updatedAt: UPDATED_AT,
  fields: [],
};

function harness({ googleConfigured }: { googleConfigured: boolean }) {
  /** Everything that happened, in order — including the transaction's edges. */
  const events: string[] = [];
  const outboxRows: Array<{
    id: string;
    dedupeKey: string;
    kind: string;
    payload: unknown;
  }> = [];
  let inTransaction = false;

  const tx = {
    card: {
      update: jest.fn(() => {
        events.push('tx.card.update');
        return Promise.resolve(cardRow);
      }),
    },
    shareLink: {
      updateMany: jest.fn(() => {
        events.push('tx.shareLink.updateMany');
        return Promise.resolve({ count: 0 });
      }),
    },
    outboxMessage: {
      create: jest.fn(
        (args: {
          data: { dedupeKey: string; kind: string; payload: unknown };
        }) => {
          if (!inTransaction) throw new Error('outbox write outside a tx');
          const row = { id: `outbox-${args.data.kind}`, ...args.data };
          outboxRows.push(row);
          events.push(`tx.outbox:${args.data.kind}`);
          return Promise.resolve(row);
        },
      ),
    },
  };

  const prisma = {
    card: { findFirst: jest.fn().mockResolvedValue(cardRow) },
    // No `outboxMessage` here on purpose: a write that bypassed the
    // transaction would be a TypeError, not a silent pass.
    $transaction: jest.fn(
      async (fn: (client: typeof tx) => Promise<unknown>) => {
        events.push('BEGIN');
        inTransaction = true;
        try {
          const result = await fn(tx);
          events.push('COMMIT');
          return result;
        } finally {
          inTransaction = false;
        }
      },
    ),
  };

  const enqueuer = {
    enqueue: jest.fn((outboxId: string) => {
      events.push(`kick:${outboxId}`);
    }),
  };

  const service = new CardsService(
    prisma as unknown as PrismaService,
    {
      shareBaseUrl: 'https://app.contactbook.example',
      fieldEncryptionKey: undefined,
      googleWallet: googleConfigured
        ? {
            issuerId: '3388000000022000000',
            serviceAccountEmail:
              'wallet@contactbook-test.iam.gserviceaccount.com',
            serviceAccountKeyB64: 'a2V5',
            classSuffix: 'card',
          }
        : undefined,
    } as unknown as AppConfigService,
    {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as AppLogger,
    new OutboxService(),
    enqueuer as unknown as TaskEnqueuer,
    {} as unknown as CardLogoStorageService,
    { deleteByUrl: jest.fn() } as unknown as CardCoverStorageService,
  );

  const googleRow = () =>
    outboxRows.find((r) => r.kind === 'google_wallet_push');
  return { service, events, outboxRows, enqueuer, googleRow };
}

describe('CardsService → google_wallet_push', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('update', () => {
    it('enqueues it in the same transaction as the card update, beside wallet_push', async () => {
      const { service, events, googleRow } = harness({
        googleConfigured: true,
      });

      await service.update('user-1', 'card-1', { headline: 'Design Director' });

      expect(events).toEqual([
        'BEGIN',
        'tx.card.update',
        'tx.outbox:wallet_push',
        'tx.outbox:google_wallet_push',
        'COMMIT',
        'kick:outbox-google_wallet_push',
      ]);
      expect(googleRow()).toMatchObject({
        dedupeKey: `google-wallet-push:card-1:${UPDATED_AT.getTime()}`,
        kind: 'google_wallet_push',
        // The card id and nothing else — the handler reads current data itself.
        payload: { cardId: 'card-1' },
      });
    });

    it('hands the row to the transport only after the commit, on the outbound queue', async () => {
      const { service, events, enqueuer } = harness({ googleConfigured: true });
      await service.update('user-1', 'card-1', { name: 'Work 2' });
      expect(enqueuer.enqueue).toHaveBeenCalledTimes(1);
      expect(enqueuer.enqueue).toHaveBeenCalledWith(
        'outbox-google_wallet_push',
        'outbound',
      );
      expect(events.indexOf('kick:outbox-google_wallet_push')).toBeGreaterThan(
        events.indexOf('COMMIT'),
      );
    });

    it('writes no row and kicks nothing when Google Wallet is not configured', async () => {
      const { service, events, enqueuer } = harness({
        googleConfigured: false,
      });
      await service.update('user-1', 'card-1', { headline: 'x' });
      // Apple's row is untouched by this feature being off.
      expect(events).toEqual([
        'BEGIN',
        'tx.card.update',
        'tx.outbox:wallet_push',
        'COMMIT',
      ]);
      expect(enqueuer.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('enqueues it in the same transaction as the archive and the link revocation', async () => {
      const { service, events, googleRow } = harness({
        googleConfigured: true,
      });

      await service.archive('user-1', 'card-1');

      expect(events).toEqual([
        'BEGIN',
        'tx.card.update',
        'tx.shareLink.updateMany',
        'tx.outbox:wallet_push',
        'tx.outbox:google_wallet_push',
        'COMMIT',
        'kick:outbox-google_wallet_push',
      ]);
      expect(googleRow()).toMatchObject({
        dedupeKey: `google-wallet-push:card-1:${NOW.getTime()}`,
        payload: { cardId: 'card-1' },
      });
    });

    it('writes no row and kicks nothing when Google Wallet is not configured', async () => {
      const { service, outboxRows, enqueuer } = harness({
        googleConfigured: false,
      });
      await service.archive('user-1', 'card-1');
      expect(outboxRows.map((r) => r.kind)).toEqual(['wallet_push']);
      expect(enqueuer.enqueue).not.toHaveBeenCalled();
    });
  });

  it('does not enqueue when the transaction fails, and kicks nothing', async () => {
    const { service, enqueuer, events } = harness({ googleConfigured: true });
    const boom = new Error('db down');
    // Fail the card write itself: nothing after it in the transaction runs.
    (
      service as unknown as {
        prisma: { $transaction: jest.Mock };
      }
    ).prisma.$transaction.mockImplementationOnce(() => Promise.reject(boom));

    await expect(
      service.update('user-1', 'card-1', { name: 'x' }),
    ).rejects.toBe(boom);
    expect(events).toEqual([]);
    expect(enqueuer.enqueue).not.toHaveBeenCalled();
  });
});
