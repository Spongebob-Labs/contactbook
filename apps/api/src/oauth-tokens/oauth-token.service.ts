import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OAuthAccount, OAuthProvider } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { decryptOAuthToken, encryptOAuthToken } from "./crypto.util";

export type OAuthTokenUpsertInput = {
  refreshToken: string;
  accessToken?: string | null;
  accessTokenExpiresAt?: Date | null;
  scope?: string | null;
};

export type OAuthAccessTokenUpdate = {
  accessToken: string;
  accessTokenExpiresAt: Date;
};

export type DecryptedOAuthCredential = {
  id: string;
  userId: string;
  provider: string;
  scope: string | null;
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
};

const PROVIDER_TO_ENUM: Record<string, OAuthProvider> = {
  google: OAuthProvider.GOOGLE,
  microsoft: OAuthProvider.MICROSOFT,
  icloud: OAuthProvider.ICLOUD,
};

function toOAuthProvider(provider: string): OAuthProvider {
  const key = provider.toLowerCase();
  const mapped = PROVIDER_TO_ENUM[key];
  if (!mapped) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
  return mapped;
}

@Injectable()
export class OAuthTokenService {
  private readonly logger = new Logger(OAuthTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  async upsertForUser(
    userId: string,
    provider: string,
    input: OAuthTokenUpsertInput,
  ): Promise<OAuthAccount> {
    const oauthProvider = toOAuthProvider(provider);
    const refreshTokenCiphertext = encryptOAuthToken(input.refreshToken);
    const accessTokenCiphertext = input.accessToken
      ? encryptOAuthToken(input.accessToken)
      : "";

    return this.prisma.oAuthAccount.upsert({
      where: {
        userId_provider: { userId, provider: oauthProvider },
      },
      update: {
        refreshToken: refreshTokenCiphertext,
        accessToken: accessTokenCiphertext,
        expiresAt: input.accessTokenExpiresAt ?? null,
        scopes: input.scope ?? "",
      },
      create: {
        userId,
        provider: oauthProvider,
        refreshToken: refreshTokenCiphertext,
        accessToken: accessTokenCiphertext,
        expiresAt: input.accessTokenExpiresAt ?? null,
        scopes: input.scope ?? "",
      },
    });
  }

  async getForUser(
    userId: string,
    provider: string,
  ): Promise<DecryptedOAuthCredential | null> {
    const oauthProvider = toOAuthProvider(provider);
    const row = await this.prisma.oAuthAccount.findUnique({
      where: { userId_provider: { userId, provider: oauthProvider } },
    });

    if (!row) return null;

    return this.decryptRow(row, provider);
  }

  async requireForUser(
    userId: string,
    provider: string,
  ): Promise<DecryptedOAuthCredential> {
    const credential = await this.getForUser(userId, provider);
    if (!credential) {
      throw new NotFoundException(
        `No ${provider} credentials connected for this user`,
      );
    }
    return credential;
  }

  async updateAccessToken(
    userId: string,
    provider: string,
    update: OAuthAccessTokenUpdate,
  ): Promise<void> {
    const oauthProvider = toOAuthProvider(provider);
    const accessTokenCiphertext = encryptOAuthToken(update.accessToken);
    await this.prisma.oAuthAccount.update({
      where: { userId_provider: { userId, provider: oauthProvider } },
      data: {
        accessToken: accessTokenCiphertext,
        expiresAt: update.accessTokenExpiresAt,
      },
    });
  }

  async deleteForUser(userId: string, provider: string): Promise<void> {
    const oauthProvider = toOAuthProvider(provider);
    try {
      await this.prisma.oAuthAccount.delete({
        where: { userId_provider: { userId, provider: oauthProvider } },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to delete ${provider} credentials for user ${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async findUserIdsByProvider(provider: string): Promise<string[]> {
    const oauthProvider = toOAuthProvider(provider);
    const rows = await this.prisma.oAuthAccount.findMany({
      where: { provider: oauthProvider },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  private decryptRow(
    row: OAuthAccount,
    provider: string,
  ): DecryptedOAuthCredential {
    return {
      id: row.id,
      userId: row.userId,
      provider,
      scope: row.scopes || null,
      refreshToken: decryptOAuthToken(row.refreshToken),
      accessToken: row.accessToken ? decryptOAuthToken(row.accessToken) : null,
      accessTokenExpiresAt: row.expiresAt,
    };
  }
}
