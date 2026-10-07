import { generateKeyPairSync } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { GoogleWalletService } from './google-wallet.service';
import {
  GOOGLE_WALLET_API,
  GoogleWalletHttpError,
  type GoogleWalletHttp,
  type GoogleWalletRequest,
} from './google-wallet.client';
import { ApiError } from '../common/errors/api-error';
import type { PrismaService } from '../prisma/prisma.service';
import type { AppConfigService } from '../config/app-config.service';
import type { AppLogger } from '../common/logging/app-logger.service';

/**
 * GoogleWalletService against a scripted double of the Google HTTP client.
 * Nothing here can reach the network: the service only ever talks to Google
 * through the injected `GoogleWalletHttp`.
 */

// A throwaway key generated for this run — never a real service account key.
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const ISSUER = '3388000000022000000';
const EMAIL = 'wallet@contactbook-test.iam.gserviceaccount.com';
const CLASS_ID = `${ISSUER}.card`;
const CARD_ID = '592a51af-0c1d-4e2f-8a3b-4c5d6e7f8a9b';
const OBJECT_ID = `${ISSUER}.${CARD_ID}`;
const SHARE_BASE = 'https://app.contactbook.example';

const CLASS_URL = `${GOOGLE_WALLET_API}/genericClass/${encodeURIComponent(CLASS_ID)}`;
const OBJECT_URL = `${GOOGLE_WALLET_API}/genericObject/${encodeURIComponent(OBJECT_ID)}`;

const GOOGLE_CFG = {
  issuerId: ISSUER,
  serviceAccountEmail: EMAIL,
  serviceAccountKeyB64: Buffer.from(privateKey).toString('base64'),
  classSuffix: 'card',
};

type CardRow = {
  id: string;
  name: string;
  headline: string | null;
  publicToken: string;
  archivedAt: Date | null;
  templateId: string | null;
  paletteId: string | null;
  groundHex: string | null;
  user: { firstName: string | null; lastName: string | null };
};

const card = (over: Partial<CardRow> = {}): CardRow => ({
  id: CARD_ID,
  name: 'Work',
  headline: 'Head of Design',
  publicToken: 'tok3nPublic',
  archivedAt: null,
  templateId: 'meridian',
  paletteId: 'emerald',
  groundHex: null,
  user: { firstName: 'Maya', lastName: 'Lauren' },
  ...over,
});

type Reply = number | 'network';

/**
 * Answers each request from a script keyed by "METHOD url". A key's replies
 * are consumed in order and the last one repeats. Unscripted calls are 200.
 */
function fakeHttp(script: Record<string, Reply[]> = {}) {
  const calls: GoogleWalletRequest[] = [];
  const http: GoogleWalletHttp = {
    request(req) {
      calls.push(req);
      const replies = script[`${req.method} ${req.url}`];
      const reply =
        replies === undefined
          ? 200
          : replies.length > 1
            ? replies.shift()!
            : replies[0];
      if (reply === 'network') {
        return Promise.reject(new GoogleWalletHttpError(undefined, req.method));
      }
      return reply >= 200 && reply < 300
        ? Promise.resolve()
        : Promise.reject(new GoogleWalletHttpError(reply, req.method));
    },
  };
  return { http, calls, sent: () => calls.map((c) => `${c.method} ${c.url}`) };
}

function harness(opts: {
  configured?: boolean;
  http?: GoogleWalletHttp | null;
  row?: CardRow | null;
}) {
  const configured = opts.configured ?? true;
  const findFirst = jest.fn().mockResolvedValue(opts.row ?? null);
  const findUnique = jest.fn().mockResolvedValue(opts.row ?? null);
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const service = new GoogleWalletService(
    { card: { findFirst, findUnique } } as unknown as PrismaService,
    {
      googleWallet: configured ? GOOGLE_CFG : undefined,
      shareBaseUrl: `${SHARE_BASE}/`,
    } as unknown as AppConfigService,
    logger as unknown as AppLogger,
    new JwtService(),
    opts.http === undefined ? null : opts.http,
  );
  return { service, findFirst, findUnique, logger };
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error('expected the call to reject');
}

describe('GoogleWalletService', () => {
  describe('when GOOGLE_WALLET_* is not set', () => {
    it('answers 409 GOOGLE_WALLET_NOT_CONFIGURED without reading the card', async () => {
      const { service, findFirst } = harness({ configured: false });
      const err = await failure(service.getSaveUrl('user-1', CARD_ID));
      expect(err.getStatus()).toBe(409);
      expect(err.code).toBe('GOOGLE_WALLET_NOT_CONFIGURED');
      expect(findFirst).not.toHaveBeenCalled();
    });

    it('does nothing at boot and nothing on a push — no query, no log, no throw', async () => {
      const { service, findUnique, logger } = harness({ configured: false });
      await expect(service.onModuleInit()).resolves.toBeUndefined();
      await expect(service.syncPassObject(CARD_ID)).resolves.toBeUndefined();
      expect(findUnique).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('getSaveUrl', () => {
    it('is 404 CARD_NOT_FOUND for a card the caller does not own, and never calls Google', async () => {
      const { http, calls } = fakeHttp();
      const { service, findFirst } = harness({ http, row: null });
      const err = await failure(service.getSaveUrl('someone-else', CARD_ID));
      expect(err.getStatus()).toBe(404);
      expect(err.code).toBe('CARD_NOT_FOUND');
      // Ownership is in the query itself, not a check after the read.
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CARD_ID, userId: 'someone-else' },
        }),
      );
      expect(calls).toHaveLength(0);
    });

    it('is 404 CARD_NOT_FOUND for an archived card, and never calls Google', async () => {
      const { http, calls } = fakeHttp();
      const { service } = harness({
        http,
        row: card({ archivedAt: new Date('2026-10-01T00:00:00Z') }),
      });
      const err = await failure(service.getSaveUrl('user-1', CARD_ID));
      expect(err.getStatus()).toBe(404);
      expect(err.code).toBe('CARD_NOT_FOUND');
      expect(calls).toHaveLength(0);
    });

    it('selects only name, headline, link and colour columns — never a profile field or phone', async () => {
      const { http } = fakeHttp();
      const { service, findFirst } = harness({ http, row: card() });
      await service.getSaveUrl('user-1', CARD_ID);
      const [[args]] = findFirst.mock.calls as [
        [{ select: Record<string, unknown> }],
      ];
      expect(Object.keys(args.select).sort()).toEqual([
        'archivedAt',
        'groundHex',
        'headline',
        'id',
        'name',
        'paletteId',
        'publicToken',
        'templateId',
        'user',
      ]);
      expect(args.select.user).toEqual({
        select: { firstName: true, lastName: true },
      });
    });

    it('upserts the object first, then returns a save URL whose JWT names it by ID only', async () => {
      const { http, calls, sent } = fakeHttp();
      const { service, logger } = harness({ http, row: card() });

      const url = await service.getSaveUrl('user-1', CARD_ID);

      // Class checked, object replaced — both before the URL exists.
      expect(sent()).toEqual([`GET ${CLASS_URL}`, `PUT ${OBJECT_URL}`]);

      const prefix = 'https://pay.google.com/gp/v/save/';
      expect(url.startsWith(prefix)).toBe(true);
      const token = url.slice(prefix.length);
      // Under Google's limit by a wide margin, because no card data is inlined.
      expect(token.length).toBeLessThan(1800);

      const claims = new JwtService().verify<Record<string, unknown>>(token, {
        publicKey,
        algorithms: ['RS256'],
      });
      expect(claims.iss).toBe(EMAIL);
      expect(claims.aud).toBe('google');
      expect(claims.typ).toBe('savetowallet');
      expect(claims.origins).toEqual([SHARE_BASE]);
      expect(claims.payload).toEqual({
        genericObjects: [{ id: OBJECT_ID, classId: CLASS_ID }],
      });

      // No card data of any kind rides in the URL.
      const json = JSON.stringify(claims);
      for (const leaked of ['Maya', 'Lauren', 'Work', 'Head of Design']) {
        expect(json).not.toContain(leaked);
      }
      expect(json).not.toContain('tok3nPublic');

      expect(logger.info).toHaveBeenCalledWith('google_wallet.url_issued', {
        userId: 'user-1',
        cardId: CARD_ID,
      });
      // The object body is the pass, built from the card's current data.
      expect(calls[1].data).toMatchObject({
        id: OBJECT_ID,
        classId: CLASS_ID,
        state: 'ACTIVE',
      });
    });

    it('creates the object with POST when the PUT says it does not exist yet', async () => {
      const { http, calls, sent } = fakeHttp({ [`PUT ${OBJECT_URL}`]: [404] });
      const { service } = harness({ http, row: card() });

      const url = await service.getSaveUrl('user-1', CARD_ID);

      expect(sent()).toEqual([
        `GET ${CLASS_URL}`,
        `PUT ${OBJECT_URL}`,
        `POST ${GOOGLE_WALLET_API}/genericObject`,
      ]);
      // The created object is the same body the PUT tried to send.
      expect(calls[2].data).toEqual(calls[1].data);
      expect(url).toMatch(/^https:\/\/pay\.google\.com\/gp\/v\/save\//);
    });

    it('replaces the object when a concurrent request created it first (POST 409)', async () => {
      const { http, sent } = fakeHttp({
        [`PUT ${OBJECT_URL}`]: [404, 200],
        [`POST ${GOOGLE_WALLET_API}/genericObject`]: [409],
      });
      const { service } = harness({ http, row: card() });
      await service.getSaveUrl('user-1', CARD_ID);
      expect(sent().slice(1)).toEqual([
        `PUT ${OBJECT_URL}`,
        `POST ${GOOGLE_WALLET_API}/genericObject`,
        `PUT ${OBJECT_URL}`,
      ]);
    });

    it('issues no URL when Google rejects the object', async () => {
      const { http } = fakeHttp({ [`PUT ${OBJECT_URL}`]: [403] });
      const { service, logger } = harness({ http, row: card() });
      await expect(service.getSaveUrl('user-1', CARD_ID)).rejects.toThrow(
        GoogleWalletHttpError,
      );
      expect(logger.info).not.toHaveBeenCalledWith(
        'google_wallet.url_issued',
        expect.anything(),
      );
    });
  });

  describe('the pass class', () => {
    it('is not re-created when it already exists', async () => {
      const { http, sent } = fakeHttp();
      const { service } = harness({ http });
      await service.onModuleInit();
      expect(sent()).toEqual([`GET ${CLASS_URL}`]);
    });

    it('is created once, then never asked about again in this process', async () => {
      const { http, calls, sent } = fakeHttp({ [`GET ${CLASS_URL}`]: [404] });
      const { service, logger } = harness({ http, row: card() });

      await service.onModuleInit();
      expect(sent()).toEqual([
        `GET ${CLASS_URL}`,
        `POST ${GOOGLE_WALLET_API}/genericClass`,
      ]);
      expect(calls[1].data).toMatchObject({ id: CLASS_ID });
      expect(logger.info).toHaveBeenCalledWith('google_wallet.class_created', {
        classId: CLASS_ID,
      });

      await service.getSaveUrl('user-1', CARD_ID);
      await service.getSaveUrl('user-1', CARD_ID);
      expect(sent().filter((s) => s.includes('genericClass'))).toHaveLength(2);
    });

    it('treats 409 on create as success — the other container won the race', async () => {
      const { http } = fakeHttp({
        [`GET ${CLASS_URL}`]: [404],
        [`POST ${GOOGLE_WALLET_API}/genericClass`]: [409],
      });
      const { service, logger } = harness({ http });
      await service.onModuleInit();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it.each<[string, Reply]>([
      ['Google is unreachable', 'network'],
      ['the credentials are refused', 403],
      ['Google is failing', 500],
    ])(
      'does not fail the boot when %s — it logs and carries on',
      async (_, reply) => {
        const { http } = fakeHttp({ [`GET ${CLASS_URL}`]: [reply] });
        const { service, logger } = harness({ http });

        await expect(service.onModuleInit()).resolves.toBeUndefined();

        expect(logger.error).toHaveBeenCalledWith(
          'google_wallet.class_sync_failed',
          expect.objectContaining({
            status: reply === 'network' ? undefined : reply,
          }),
        );
      },
    );

    it('is retried by the next save after a failed boot', async () => {
      const { http, sent } = fakeHttp({
        [`GET ${CLASS_URL}`]: ['network', 404],
      });
      const { service } = harness({ http, row: card() });
      await service.onModuleInit();

      await service.getSaveUrl('user-1', CARD_ID);

      expect(sent()).toEqual([
        `GET ${CLASS_URL}`,
        `GET ${CLASS_URL}`,
        `POST ${GOOGLE_WALLET_API}/genericClass`,
        `PUT ${OBJECT_URL}`,
      ]);
    });
  });

  describe('syncPassObject (the google_wallet_push handler)', () => {
    it('replaces the saved pass with the card as it is now', async () => {
      const { http, calls, sent } = fakeHttp();
      const { service, logger } = harness({
        http,
        row: card({ headline: 'Design Director' }),
      });

      await service.syncPassObject(CARD_ID);

      expect(sent()).toEqual([`PUT ${OBJECT_URL}`]);
      expect(calls[0].data).toMatchObject({
        state: 'ACTIVE',
        subheader: {
          defaultValue: { language: 'en-US', value: 'Design Director' },
        },
      });
      expect(logger.info).toHaveBeenCalledWith('google_wallet.pass_synced', {
        cardId: CARD_ID,
        state: 'ACTIVE',
      });
    });

    it('marks the pass EXPIRED when the card is archived', async () => {
      const { http, calls } = fakeHttp();
      const { service, logger } = harness({
        http,
        row: card({ archivedAt: new Date('2026-10-01T00:00:00Z') }),
      });

      await service.syncPassObject(CARD_ID);

      expect(calls[0].method).toBe('PUT');
      expect(calls[0].data).toMatchObject({ state: 'EXPIRED' });
      expect(logger.info).toHaveBeenCalledWith('google_wallet.pass_synced', {
        cardId: CARD_ID,
        state: 'EXPIRED',
      });
    });

    it('does not create a pass for a card nobody saved to Google Wallet', async () => {
      const { http, sent } = fakeHttp({ [`PUT ${OBJECT_URL}`]: [404] });
      const { service, logger } = harness({ http, row: card() });

      await service.syncPassObject(CARD_ID);

      // One PUT, and no POST: an edit never sends a card to Google by itself.
      expect(sent()).toEqual([`PUT ${OBJECT_URL}`]);
      expect(logger.info).toHaveBeenCalledWith(
        'google_wallet.pass_sync_skipped',
        { cardId: CARD_ID },
      );
    });

    it('is a no-op for a card that no longer exists', async () => {
      const { http, calls } = fakeHttp();
      const { service } = harness({ http, row: null });
      await expect(service.syncPassObject(CARD_ID)).resolves.toBeUndefined();
      expect(calls).toHaveLength(0);
    });

    it('throws when Google fails, so the outbox keeps the row', async () => {
      const { http } = fakeHttp({ [`PUT ${OBJECT_URL}`]: [503] });
      const { service } = harness({ http, row: card() });
      await expect(service.syncPassObject(CARD_ID)).rejects.toThrow(
        'Google Wallet API answered 503 (PUT)',
      );
    });
  });

  it('never logs the name, headline, link or key', async () => {
    const { http } = fakeHttp({ [`GET ${CLASS_URL}`]: [404] });
    const { service, logger } = harness({ http, row: card() });
    await service.onModuleInit();
    await service.getSaveUrl('user-1', CARD_ID);
    await service.syncPassObject(CARD_ID);

    const calls = (mock: jest.Mock): unknown[] => mock.mock.calls;
    const logged = JSON.stringify([
      ...calls(logger.info),
      ...calls(logger.warn),
      ...calls(logger.error),
    ]);
    for (const secret of ['Maya', 'Head of Design', 'tok3nPublic', 'PRIVATE']) {
      expect(logged).not.toContain(secret);
    }
  });
});
