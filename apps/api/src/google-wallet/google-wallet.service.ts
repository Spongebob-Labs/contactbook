import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { ApiError } from '../common/errors/api-error';
import {
  GOOGLE_WALLET_API,
  GOOGLE_WALLET_HTTP,
  GoogleWalletHttpError,
  type GoogleWalletHttp,
} from './google-wallet.client';
import {
  GOOGLE_WALLET_CARD_SELECT,
  buildPassClass,
  buildPassObject,
  passClassId,
  passObjectId,
  type GoogleWalletCard,
} from './google-wallet-pass.util';

const SAVE_URL_BASE = 'https://pay.google.com/gp/v/save';

function statusOf(err: unknown): number | undefined {
  return err instanceof GoogleWalletHttpError ? err.status : undefined;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Google Wallet passes for cards.
 *
 * Fully inert when the four GOOGLE_WALLET_* vars are absent: no client is
 * built, nothing is called at boot, the owner endpoint answers 409
 * GOOGLE_WALLET_NOT_CONFIGURED and the outbox handler is a no-op.
 *
 * Google is called from exactly two places: the owner's GET save-url request
 * (which must create the object before it can sign a JWT naming it), and the
 * `google_wallet_push` outbox handler. Never from a card edit's request path.
 */
@Injectable()
export class GoogleWalletService implements OnModuleInit {
  private readonly cfg: AppConfigService['googleWallet'];
  private readonly privateKeyPem: string;
  /** Memoised so the class is checked/created once per process, not once per pass. */
  private classReady: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
    private readonly jwt: JwtService,
    @Inject(GOOGLE_WALLET_HTTP) private readonly http: GoogleWalletHttp | null,
  ) {
    this.cfg = config.googleWallet;
    this.privateKeyPem = this.cfg
      ? Buffer.from(this.cfg.serviceAccountKeyB64, 'base64').toString('utf8')
      : '';
  }

  /**
   * Creates the pass class ahead of the first save. A failure here (Google
   * unreachable, bad credentials, API not enabled) must never take the API
   * down: it is logged and boot continues. The class is retried lazily by the
   * next call that needs it.
   */
  async onModuleInit(): Promise<void> {
    if (!this.cfg || !this.http) return;
    try {
      await this.ensurePassClass();
    } catch (err) {
      this.logger.error('google_wallet.class_sync_failed', {
        status: statusOf(err),
        err: describe(err),
      });
    }
  }

  /** Returns the Save to Google Wallet URL for a card the caller owns. */
  async getSaveUrl(userId: string, cardId: string): Promise<string> {
    if (!this.cfg || !this.http) {
      throw ApiError.conflict(
        'GOOGLE_WALLET_NOT_CONFIGURED',
        'Google Wallet is not configured on this server.',
      );
    }

    const card = await this.prisma.card.findFirst({
      where: { id: cardId, userId },
      select: GOOGLE_WALLET_CARD_SELECT,
    });

    // Archived is not-found from the owner's side, as on the Apple endpoint.
    if (!card || card.archivedAt) {
      throw ApiError.notFound('CARD_NOT_FOUND', 'Card not found.');
    }

    // The object must exist before the JWT names it: the JWT carries IDs
    // only, which keeps it far under Google's ~1800-char limit and keeps
    // every piece of card data out of a URL.
    await this.ensurePassClass();
    await this.putPassObject(card, { createIfMissing: true });

    const token = this.jwt.sign(
      {
        iss: this.cfg.serviceAccountEmail,
        aud: 'google',
        typ: 'savetowallet',
        origins: [new URL(this.config.shareBaseUrl).origin],
        payload: {
          genericObjects: [
            {
              id: passObjectId(this.cfg.issuerId, card.id),
              classId: passClassId(this.cfg.issuerId, this.cfg.classSuffix),
            },
          ],
        },
      },
      { privateKey: this.privateKeyPem, algorithm: 'RS256' },
    );

    this.logger.info('google_wallet.url_issued', { userId, cardId });
    return `${SAVE_URL_BASE}/${token}`;
  }

  /**
   * Brings a saved pass in line with the card's current data. Called by the
   * `google_wallet_push` outbox handler after a card edit or archive; Google
   * then propagates the change to every device holding the pass.
   *
   * Update-only: a card nobody has saved to Google Wallet has no object, and
   * this does not create one. Creating is the owner's explicit act
   * (`getSaveUrl`) — an edit must not send a card's name to Google on behalf
   * of an owner who never asked for a pass.
   *
   * Throws on any other failure so the outbox keeps the row for a retry.
   */
  async syncPassObject(cardId: string): Promise<void> {
    if (!this.cfg || !this.http) return;

    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: GOOGLE_WALLET_CARD_SELECT,
    });
    if (!card) return;

    const updated = await this.putPassObject(card, { createIfMissing: false });
    this.logger.info(
      updated ? 'google_wallet.pass_synced' : 'google_wallet.pass_sync_skipped',
      {
        cardId,
        ...(updated && { state: card.archivedAt ? 'EXPIRED' : 'ACTIVE' }),
      },
    );
  }

  /** GET the class; create it on 404. Shared by every caller in this process. */
  private ensurePassClass(): Promise<void> {
    this.classReady ??= this.createPassClassIfMissing().catch((err) => {
      // Not cached: the next caller tries again rather than inheriting a
      // failure from a moment when Google was unreachable.
      this.classReady = null;
      throw err;
    });
    return this.classReady;
  }

  private async createPassClassIfMissing(): Promise<void> {
    const http = this.http!;
    const classId = passClassId(this.cfg!.issuerId, this.cfg!.classSuffix);
    try {
      await http.request({
        method: 'GET',
        url: `${GOOGLE_WALLET_API}/genericClass/${encodeURIComponent(classId)}`,
      });
      return;
    } catch (err) {
      if (statusOf(err) !== 404) throw err;
    }

    try {
      await http.request({
        method: 'POST',
        url: `${GOOGLE_WALLET_API}/genericClass`,
        data: buildPassClass(classId),
      });
      this.logger.info('google_wallet.class_created', { classId });
    } catch (err) {
      // 409: another container created it between our GET and POST (a deploy
      // briefly runs two). It exists, which is all this needed.
      if (statusOf(err) !== 409) throw err;
    }
  }

  /**
   * PUT replaces the whole object, so a cleared headline is really cleared
   * (PATCH would merge and leave the stale one). 404 means the object does
   * not exist yet: POST it when asked to, otherwise report `false`.
   */
  private async putPassObject(
    card: GoogleWalletCard,
    { createIfMissing }: { createIfMissing: boolean },
  ): Promise<boolean> {
    const http = this.http!;
    const ids = {
      classId: passClassId(this.cfg!.issuerId, this.cfg!.classSuffix),
      objectId: passObjectId(this.cfg!.issuerId, card.id),
    };
    const data = buildPassObject(card, ids, this.config.shareBaseUrl);
    const put = () =>
      http.request({
        method: 'PUT',
        url: `${GOOGLE_WALLET_API}/genericObject/${encodeURIComponent(ids.objectId)}`,
        data,
      });

    try {
      await put();
      return true;
    } catch (err) {
      if (statusOf(err) !== 404) throw err;
    }
    if (!createIfMissing) return false;

    try {
      await http.request({
        method: 'POST',
        url: `${GOOGLE_WALLET_API}/genericObject`,
        data,
      });
    } catch (err) {
      // 409: a concurrent request created it first. Replace it so the object
      // still ends up as this request's data.
      if (statusOf(err) !== 409) throw err;
      await put();
    }
    return true;
  }
}
