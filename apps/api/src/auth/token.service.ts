import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { ApiError } from '../common/errors/api-error';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseTtlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) throw new Error(`Invalid TTL string: ${ttl}`);
  const n = Number(match[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
    match[2] as 's' | 'm' | 'h' | 'd'
  ];
  return n * unit;
}

/**
 * Access tokens are short-lived JWTs. Refresh tokens are opaque random
 * strings — only their SHA-256 hash is stored, looked up by exact match. That
 * is a different primitive from the OTP's bcrypt hash on purpose: OTP hashes
 * are only ever compared (bcrypt.compare against one candidate), refresh
 * token hashes are looked up by equality across the whole table, which bcrypt
 * cannot do (its salt makes every hash of the same input different).
 *
 * Rotation + reuse detection: verifying a refresh token that has already been
 * replaced (replacedById is set) means someone is replaying a stolen token
 * after the legitimate client already rotated past it — the whole family is
 * revoked.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {}

  async issueForUser(
    userId: string,
    phoneE164: string,
    familyId?: string,
  ): Promise<IssuedTokens> {
    const { accessSecret, refreshSecret, accessTtl, refreshTtl } =
      this.config.jwt;
    if (!accessSecret || !refreshSecret) {
      throw new Error('JWT secrets are not configured');
    }

    const accessToken = await this.jwt.signAsync(
      { sub: userId, phoneE164 },
      // `expiresIn` narrows to a template-literal union in @nestjs/jwt's
      // types; our TTLs are our own config strings ('15m', '30d'), never user
      // input, so a cast here is safe rather than fighting the type.
      { secret: accessSecret, expiresIn: accessTtl } as JwtSignOptions,
    );

    const refreshToken = randomBytes(32).toString('base64url');
    const refreshTtlMs = parseTtlToMs(refreshTtl);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        familyId: familyId ?? randomBytes(16).toString('hex'),
        expiresAt: new Date(Date.now() + refreshTtlMs),
      },
    });

    return {
      accessToken,
      refreshToken,
      accessTtlSeconds: Math.floor(parseTtlToMs(accessTtl) / 1000),
      refreshTtlSeconds: Math.floor(refreshTtlMs / 1000),
    };
  }

  async rotate(presentedToken: string): Promise<IssuedTokens> {
    const tokenHash = sha256(presentedToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing || existing.expiresAt < new Date()) {
      throw ApiError.forbidden(
        'REFRESH_INVALID',
        'Session expired. Please log in again.',
      );
    }

    if (existing.revokedAt || existing.replacedById) {
      // Reuse of an already-rotated (or already-revoked) token: the presented
      // token was stolen and the legitimate client has already moved past it.
      // Kill the whole family, not just this token.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn('auth.refresh_reuse_detected', {
        userId: existing.userId,
        familyId: existing.familyId,
      });
      throw ApiError.forbidden(
        'REFRESH_REUSE_DETECTED',
        'Session invalidated. Please log in again.',
      );
    }

    const issued = await this.issueForUser(
      existing.userId,
      existing.user.phoneE164,
      existing.familyId,
    );

    const newHash = sha256(issued.refreshToken);
    const newRow = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: newHash },
    });
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedById: newRow?.id },
    });

    return issued;
  }

  async revokeFamily(presentedToken: string): Promise<void> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(presentedToken) },
    });
    if (!existing) return;
    await this.prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
