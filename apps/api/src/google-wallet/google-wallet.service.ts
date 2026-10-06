import { createSign } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { ApiError } from '../common/errors/api-error';

const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';

type GoogleWalletCfg = {
  issuerId: string;
  serviceAccountEmail: string;
  serviceAccountKeyB64: string;
  classSuffix: string;
};

function signJwt(payload: object, privateKey: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${header}.${body}`;
  const sign = createSign('RSA-SHA256');
  sign.update(data);
  return `${data}.${sign.sign(privateKey, 'base64url')}`;
}

@Injectable()
export class GoogleWalletService implements OnModuleInit {
  private auth?: GoogleAuth;
  private privateKey?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    const cfg = config.googleWallet;
    if (cfg) {
      this.privateKey = Buffer.from(
        cfg.serviceAccountKeyB64,
        'base64',
      ).toString('utf8');
      this.auth = new GoogleAuth({
        credentials: {
          client_email: cfg.serviceAccountEmail,
          private_key: this.privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
      });
    }
  }

  async onModuleInit(): Promise<void> {
    const cfg = this.config.googleWallet;
    if (!cfg) return;
    await this.upsertPassClass(cfg);
  }

  async getSaveUrl(userId: string, cardId: string): Promise<string> {
    const cfg = this.config.googleWallet;
    if (!cfg) {
      throw ApiError.conflict(
        'GOOGLE_WALLET_NOT_CONFIGURED',
        'Google Wallet is not configured on this server.',
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
        groundHex: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!card || card.archivedAt) {
      throw ApiError.notFound('CARD_NOT_FOUND', 'Card not found.');
    }

    await this.upsertPassObject(cfg, card);

    const objectId = `${cfg.issuerId}.${cardId}`;
    const classId = `${cfg.issuerId}.${cfg.classSuffix}`;
    const claims = {
      iss: cfg.serviceAccountEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: [this.config.shareBaseUrl],
      payload: { genericObjects: [{ id: objectId, classId }] },
    };

    const token = signJwt(claims, this.privateKey!);
    this.logger.info('google_wallet.url_issued', { userId, cardId });
    return `https://pay.google.com/gp/v/save/${token}`;
  }

  async syncPassObject(cardId: string): Promise<void> {
    const cfg = this.config.googleWallet;
    if (!cfg) return;

    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        name: true,
        headline: true,
        publicToken: true,
        archivedAt: true,
        groundHex: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!card) return;
    await this.upsertPassObject(cfg, card);
    this.logger.info('google_wallet.pass_synced', { cardId });
  }

  private async upsertPassClass(cfg: GoogleWalletCfg): Promise<void> {
    const classId = `${cfg.issuerId}.${cfg.classSuffix}`;
    const client = await this.auth!.getClient();
    const url = `${WALLET_API}/genericClass/${encodeURIComponent(classId)}`;
    try {
      await (client as any).request({ url, method: 'GET' });
    } catch (err: any) {
      if (err?.response?.status !== 404) throw err;
      await (client as any).request({
        url: `${WALLET_API}/genericClass`,
        method: 'POST',
        data: {
          id: classId,
          classTemplateInfo: {
            cardTemplateOverride: {
              cardRowTemplateInfos: [
                {
                  twoItems: {
                    startItem: {
                      firstValue: {
                        fields: [
                          { fieldPath: 'object.textModulesData["headline"]' },
                        ],
                      },
                    },
                    endItem: {
                      firstValue: {
                        fields: [
                          { fieldPath: 'object.textModulesData["card"]' },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      });
    }
  }

  private async upsertPassObject(
    cfg: GoogleWalletCfg,
    card: {
      id: string;
      name: string;
      headline: string | null;
      publicToken: string;
      archivedAt: Date | null;
      groundHex: string | null;
      user: { firstName: string | null; lastName: string | null };
    },
  ): Promise<void> {
    const objectId = `${cfg.issuerId}.${card.id}`;
    const classId = `${cfg.issuerId}.${cfg.classSuffix}`;
    const ownerName = [card.user.firstName, card.user.lastName]
      .filter(Boolean)
      .join(' ');
    const shareUrl = `${this.config.shareBaseUrl}/c/${card.publicToken}`;

    const headerValue = ownerName || card.name;
    const subheaderValue = card.headline?.trim() || null;

    const passObject = {
      id: objectId,
      classId,
      genericType: 'GENERIC_OTHER',
      state: card.archivedAt ? 'EXPIRED' : 'ACTIVE',
      header: { defaultValue: { language: 'en-US', value: headerValue } },
      ...(subheaderValue
        ? { subheader: { defaultValue: { language: 'en-US', value: subheaderValue } } }
        : {}),
      cardTitle: { defaultValue: { language: 'en-US', value: card.name } },
      hexBackgroundColor: card.groundHex ?? '#1a1a1a',
      barcode: {
        type: 'QR_CODE',
        value: shareUrl,
        alternateText: 'Scan to open card',
      },
      textModulesData: [
        { id: 'headline', header: 'TITLE', body: card.headline ?? '' },
        { id: 'card', header: 'CARD', body: card.name },
        { id: 'link', header: 'CARD LINK', body: shareUrl },
      ],
    };

    const client = await this.auth!.getClient();
    const url = `${WALLET_API}/genericObject/${encodeURIComponent(objectId)}`;

    try {
      await (client as any).request({ url, method: 'PUT', data: passObject });
    } catch (err: any) {
      if (err?.response?.status !== 404) throw err;
      await (client as any).request({
        url: `${WALLET_API}/genericObject`,
        method: 'POST',
        data: passObject,
      });
    }
  }
}
