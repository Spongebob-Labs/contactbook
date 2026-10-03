import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { ApiError } from '../common/errors/api-error';
import { buildPass } from './pass-builder';
import { verifyAuthToken } from './pass-auth.util';
import { sendApnsPush } from './apns-client';

@Injectable()
export class WalletPassService {
  private readonly walletConfig:
    | {
        passTypeId: string;
        teamId: string;
        orgName: string;
        webServiceUrl: string;
        signerCertB64: string;
        signerKeyB64: string;
        signerKeyPassphrase: string | undefined;
        wwdrCertB64: string;
        authSecret: string;
      }
    | undefined;

  private readonly signerCertPem: string;
  private readonly signerKeyPem: string;
  private readonly wwdrCertPem: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    const w = config.wallet;
    this.walletConfig = w;

    // Decode certs once at service construction — fail fast if base64 is corrupt.
    if (w) {
      this.signerCertPem = Buffer.from(w.signerCertB64, 'base64').toString(
        'utf8',
      );
      this.signerKeyPem = Buffer.from(w.signerKeyB64, 'base64').toString(
        'utf8',
      );
      this.wwdrCertPem = Buffer.from(w.wwdrCertB64, 'base64').toString('utf8');
    } else {
      this.signerCertPem = '';
      this.signerKeyPem = '';
      this.wwdrCertPem = '';
    }
  }

  /** Builds a signed .pkpass for a card the caller owns. */
  async buildPassForCard(userId: string, cardId: string): Promise<Buffer> {
    if (!this.walletConfig) {
      throw ApiError.conflict(
        'WALLET_NOT_CONFIGURED',
        'Apple Wallet pass signing is not configured on this server.',
      );
    }

    const card = await this.prisma.card.findFirst({
      where: { id: cardId, userId },
      select: {
        id: true,
        name: true,
        headline: true,
        publicToken: true,
        archivedAt: true,
        templateId: true,
        paletteId: true,
        groundHex: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    // Treat archived same as not-found from the owner's perspective (consistent
    // with the skill spec — archived → CARD_NOT_FOUND on the owner endpoint).
    if (!card || card.archivedAt) {
      throw ApiError.notFound('CARD_NOT_FOUND', 'Card not found.');
    }

    const buffer = buildPass(card, card.user, {
      passTypeId: this.walletConfig.passTypeId,
      teamId: this.walletConfig.teamId,
      orgName: this.walletConfig.orgName,
      webServiceUrl: this.walletConfig.webServiceUrl,
      signerCertPem: this.signerCertPem,
      signerKeyPem: this.signerKeyPem,
      signerKeyPassphrase: this.walletConfig.signerKeyPassphrase,
      wwdrCertPem: this.wwdrCertPem,
      authSecret: this.walletConfig.authSecret,
      shareBaseUrl: this.config.shareBaseUrl,
    });

    this.logger.info('wallet.pass_issued', { userId, cardId });
    return buffer;
  }

  /** Rebuilds the pass for Apple's web service. Returns the pass + Last-Modified tag. */
  async buildPassForApple(
    passTypeId: string,
    serialNumber: string,
    authToken: string,
  ): Promise<{ buffer: Buffer; lastModifiedTag: string } | null> {
    if (!this.walletConfig) return null;
    if (passTypeId !== this.walletConfig.passTypeId) return null;

    if (!verifyAuthToken(this.walletConfig.authSecret, serialNumber, authToken)) {
      return null;
    }

    const card = await this.prisma.card.findFirst({
      where: { id: serialNumber },
      select: {
        id: true,
        name: true,
        headline: true,
        publicToken: true,
        archivedAt: true,
        templateId: true,
        paletteId: true,
        groundHex: true,
        updatedAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!card) return null;

    const buffer = buildPass(card, card.user, {
      passTypeId: this.walletConfig.passTypeId,
      teamId: this.walletConfig.teamId,
      orgName: this.walletConfig.orgName,
      webServiceUrl: this.walletConfig.webServiceUrl,
      signerCertPem: this.signerCertPem,
      signerKeyPem: this.signerKeyPem,
      signerKeyPassphrase: this.walletConfig.signerKeyPassphrase,
      wwdrCertPem: this.wwdrCertPem,
      authSecret: this.walletConfig.authSecret,
      shareBaseUrl: this.config.shareBaseUrl,
    });

    const lastModifiedTag = String(
      Math.max(
        card.updatedAt.getTime(),
        card.user.updatedAt.getTime(),
      ),
    );

    return { buffer, lastModifiedTag };
  }

  /**
   * Registers or updates a device's push token for a card.
   * Returns 'created' (new registration), 'updated' (already existed), or 'unauthorized'.
   */
  async registerDevice(
    passTypeId: string,
    serialNumber: string,
    deviceLibraryId: string,
    authToken: string,
    pushToken: string,
  ): Promise<'created' | 'updated' | 'unauthorized'> {
    if (!this.walletConfig) return 'unauthorized';
    if (passTypeId !== this.walletConfig.passTypeId) return 'unauthorized';
    if (!verifyAuthToken(this.walletConfig.authSecret, serialNumber, authToken)) {
      return 'unauthorized';
    }

    const card = await this.prisma.card.findUnique({
      where: { id: serialNumber },
      select: { id: true },
    });
    if (!card) return 'unauthorized';

    const existing = await this.prisma.walletRegistration.findUnique({
      where: {
        deviceLibraryId_cardId: { deviceLibraryId, cardId: serialNumber },
      },
    });

    await this.prisma.walletRegistration.upsert({
      where: {
        deviceLibraryId_cardId: { deviceLibraryId, cardId: serialNumber },
      },
      create: { cardId: serialNumber, deviceLibraryId, pushToken },
      update: { pushToken },
    });

    this.logger.info('wallet.device_registered', {
      cardId: serialNumber,
      deviceLibraryId,
    });

    return existing ? 'updated' : 'created';
  }

  /** Removes a device registration. Idempotent. */
  async unregisterDevice(
    passTypeId: string,
    serialNumber: string,
    deviceLibraryId: string,
    authToken: string,
  ): Promise<boolean> {
    if (!this.walletConfig) return false;
    if (passTypeId !== this.walletConfig.passTypeId) return false;
    if (!verifyAuthToken(this.walletConfig.authSecret, serialNumber, authToken)) {
      return false;
    }

    await this.prisma.walletRegistration.deleteMany({
      where: { deviceLibraryId, cardId: serialNumber },
    });

    this.logger.info('wallet.device_unregistered', {
      cardId: serialNumber,
      deviceLibraryId,
    });

    return true;
  }

  /**
   * Returns the serial numbers of passes registered to a device that have been
   * updated since `passesUpdatedSince` (epoch-ms string). Returns null when
   * the device has no registrations at all.
   */
  async getUpdatedPasses(
    passTypeId: string,
    deviceLibraryId: string,
    passesUpdatedSince: string | undefined,
  ): Promise<{ serialNumbers: string[]; lastUpdated: string } | null> {
    if (!this.walletConfig) return null;
    if (passTypeId !== this.walletConfig.passTypeId) return null;

    const registrations = await this.prisma.walletRegistration.findMany({
      where: { deviceLibraryId },
      select: {
        cardId: true,
        card: {
          select: {
            updatedAt: true,
            user: { select: { updatedAt: true } },
          },
        },
      },
    });

    if (registrations.length === 0) return null;

    const sinceMs = passesUpdatedSince ? parseInt(passesUpdatedSince, 10) : 0;
    const sinceDate = new Date(sinceMs);

    const updated: string[] = [];
    let maxTag = 0;

    for (const reg of registrations) {
      const tag = Math.max(
        reg.card.updatedAt.getTime(),
        reg.card.user.updatedAt.getTime(),
      );
      if (tag > maxTag) maxTag = tag;
      if (reg.card.updatedAt > sinceDate || reg.card.user.updatedAt > sinceDate) {
        updated.push(reg.cardId);
      }
    }

    return { serialNumbers: updated, lastUpdated: String(maxTag) };
  }

  /**
   * Sends APNs pushes to all devices that registered a given card.
   * Called by the wallet_push outbox handler.
   * Deletes registrations for dead tokens (APNs 410 or BadDeviceToken).
   */
  async pushToCard(cardId: string): Promise<void> {
    if (!this.walletConfig) return;

    const registrations = await this.prisma.walletRegistration.findMany({
      where: { cardId },
      select: { id: true, pushToken: true },
    });

    for (const reg of registrations) {
      const result = await sendApnsPush(
        reg.pushToken,
        this.walletConfig.passTypeId,
        this.signerCertPem,
        this.signerKeyPem,
        this.walletConfig.signerKeyPassphrase,
      );

      if (result.tokenExpired) {
        // Conditional on pushToken so a concurrent re-registration (new token
        // on same row) is not deleted by a stale 410 for the old token.
        await this.prisma.walletRegistration.deleteMany({
          where: { id: reg.id, pushToken: reg.pushToken },
        });
        this.logger.info('wallet.token_expired_removed', { cardId });
      } else if (!result.ok) {
        this.logger.warn('wallet.push_failed', {
          cardId,
          status: result.status,
          body: result.body,
        });
        throw new Error(`APNs push failed: status ${result.status} — ${result.body}`);
      } else {
        this.logger.info('wallet.push_sent', { cardId });
      }
    }
  }
}
