import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { OAuthAccount, OAuthProvider, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { decryptOAuthTokenStored, encryptOAuthToken } from "./crypto.util";

export type OAuthTokenUpsertInput = {
  refreshToken: string;
  accessToken?: string | null;
  accessTokenExpiresAt?: Date | null;
  scope?: string | null;
  providerAccountId?: string | null;
  providerState?: Prisma.InputJsonValue | null;
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
  providerAccountId: string | null;
  providerState: Prisma.JsonValue | null;
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

function toProviderStateInput(
  value: Prisma.InputJsonValue | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.DbNull;
  }
  return value;
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
        ...(input.scope !== undefined && { scopes: input.scope ?? "" }),
        ...(input.providerAccountId !== undefined && {
          providerAccountId: input.providerAccountId,
        }),
        ...(input.providerState !== undefined && {
          providerState: toProviderStateInput(input.providerState),
        }),
      },
      create: {
        userId,
        provider: oauthProvider,
        refreshToken: refreshTokenCiphertext,
        accessToken: accessTokenCiphertext,
        expiresAt: input.accessTokenExpiresAt ?? null,
        scopes: input.scope ?? "",
        providerAccountId: input.providerAccountId ?? null,
        providerState: toProviderStateInput(input.providerState),
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
    try {
      return {
        id: row.id,
        userId: row.userId,
        provider,
        scope: row.scopes || null,
        refreshToken: decryptOAuthTokenStored(row.refreshToken),
        accessToken: row.accessToken
          ? decryptOAuthTokenStored(row.accessToken)
          : null,
        accessTokenExpiresAt: row.expiresAt,
        providerAccountId: row.providerAccountId,
        providerState: row.providerState,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      this.logger.error(
        `Failed to decrypt ${provider} OAuth tokens for user ${row.userId}: ${reason}`,
      );
      const keyMismatch =
        reason.includes("Unsupported state or unable to authenticate data") ||
        reason.includes("Malformed encrypted OAuth token payload");
      throw new BadRequestException(
        keyMismatch
          ? `Stored ${provider} credentials could not be decrypted. The server encryption key may not match the environment where this account was linked. Disconnect and reconnect ${provider}, or use the matching OAUTH_TOKEN_ENCRYPTION_KEY_BASE64.`
          : `Stored ${provider} credentials could not be read. Disconnect and reconnect the account.`,
      );
    }
  }
}
