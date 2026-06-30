import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { SignOptions } from "jsonwebtoken";
import type { User } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import {
  composeE164,
  normalizeDialCode,
  normalizeNationalPhone,
  type PhoneIdentity,
} from "../common/phone.util";
import { PrismaService } from "../prisma/prisma.service";
import { PHONE_VERIFICATION_JWT_TYP } from "./auth.constants";
import type { CompleteRegisterDto } from "./dto/complete-register.dto";
import { OtpService } from "./otp.service";
import { parseRelativeMs } from "./parse-relative-ms";

/** Public JSON body for verify-code (session cookies set on the response when registered). */
export type VerifyWhatsappCodeResponse =
  | { registered: true; isOnboarded: boolean }
  | {
      registered: false;
      message: string;
      phoneVerificationToken: string;
    };

/** Service result before the controller sets session cookies. */
export type VerifyWhatsappCodeResult =
  | {
      registered: true;
      isOnboarded: boolean;
      userId: string;
      accessToken: string;
      refreshToken: string;
    }
  | {
      registered: false;
      message: string;
      phoneVerificationToken: string;
    };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otp: OtpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Sends a WhatsApp OTP for any phone (registered or not).
   */
  async requestWhatsappCode(
    phoneRaw: string,
    countryCallingPrefix: string,
  ): Promise<{ message: string }> {
    const phone = normalizeNationalPhone(phoneRaw);
    const countryCode = normalizeDialCode(countryCallingPrefix);
    const e164 = composeE164(countryCode, phone);
    const user = await this.prisma.user.findUnique({
      where: { countryCode_phone: { countryCode, phone } },
    });
    await this.otp.sendPhoneOtp(e164, user?.id ?? null);
    return { message: "Verification code sent to your WhatsApp number." };
  }

  async verifyWhatsappCode(
    phoneRaw: string,
    countryCallingPrefix: string,
    code: string,
  ): Promise<VerifyWhatsappCodeResult> {
    const phone = normalizeNationalPhone(phoneRaw);
    const countryCode = normalizeDialCode(countryCallingPrefix);
    const e164 = composeE164(countryCode, phone);
    const userId = await this.otp.verifyPhoneOtp(e164, code);
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, profileOnboardingCompletedAt: true },
      });
      if (!user) {
        throw new UnauthorizedException();
      }
      const tokens = await this.issueTokenPair(user.id);
      return {
        registered: true,
        isOnboarded: user.profileOnboardingCompletedAt != null,
        userId: user.id,
        ...tokens,
      };
    }
    return {
      registered: false,
      message:
        "No account for this phone number. Register with your name, email, and the same phone number.",
      phoneVerificationToken: this.signPhoneVerificationJwt({
        phone,
        countryCode,
      }),
    };
  }

  async completeRegister(
    dto: CompleteRegisterDto,
  ): Promise<{ userId: string; accessToken: string; refreshToken: string }> {
    const claims = this.verifyPhoneVerificationJwt(dto.phoneVerificationToken);
    const phone = normalizeNationalPhone(dto.phone);
    const countryCode = normalizeDialCode(dto.countryCode);
    if (claims.phone !== phone || claims.countryCode !== countryCode) {
      throw new UnauthorizedException(
        "Phone number does not match verification",
      );
    }
    const email = dto.email.trim().toLowerCase();
    const existingPhone = await this.prisma.user.findUnique({
      where: { countryCode_phone: { countryCode, phone } },
    });
    if (existingPhone) {
      throw new ConflictException("This phone number is already registered");
    }
    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException("This email is already in use");
    }
    const user = await this.prisma.user.create({
      data: {
        phone,
        countryCode,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
        isActive: true,
      },
    });
    const tokens = await this.issueTokenPair(user.id);
    return { userId: user.id, ...tokens };
  }

  /**
   * Revokes the refresh token row if the raw token matches an active session.
   * Used on logout; missing or invalid tokens are ignored.
   */
  async logoutByRefreshToken(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }
    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async refreshSession(refreshToken: string): Promise<{
    userId: string;
    accessToken: string;
    refreshToken: string;
  }> {
    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!row || row.revokedAt || row.expiresAt <= new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    const tokens = await this.issueTokenPair(row.userId, row.id);
    return { userId: row.userId, ...tokens };
  }

  private signAccessToken(user: User): string {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      phone: user.phone,
      countryCode: user.countryCode,
    });
  }

  private signPhoneVerificationJwt(identity: PhoneIdentity): string {
    return this.jwt.sign(
      {
        typ: PHONE_VERIFICATION_JWT_TYP,
        phone: identity.phone,
        countryCode: identity.countryCode,
      },
      {
        expiresIn: this.config.get<string>(
          "JWT_PHONE_VERIFY_EXPIRES_IN",
          "10m",
        ) as NonNullable<SignOptions["expiresIn"]>,
      },
    );
  }

  private verifyPhoneVerificationJwt(token: string): PhoneIdentity {
    let payload: unknown;
    try {
      payload = this.jwt.verify(token, {
        secret: this.config.get<string>(
          "JWT_SECRET",
          "change-me-in-production",
        ),
      });
    } catch {
      throw new UnauthorizedException(
        "Invalid or expired phone verification. Request a new code.",
      );
    }
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("typ" in payload) ||
      !("phone" in payload) ||
      !("countryCode" in payload)
    ) {
      throw new UnauthorizedException("Invalid phone verification token");
    }
    const p = payload;
    if (
      p.typ !== PHONE_VERIFICATION_JWT_TYP ||
      typeof p.phone !== "string" ||
      typeof p.countryCode !== "string"
    ) {
      throw new UnauthorizedException("Invalid phone verification token");
    }
    return {
      phone: normalizeNationalPhone(p.phone),
      countryCode: normalizeDialCode(p.countryCode),
    };
  }

  private async issueTokenPair(
    userId: string,
    revokeRefreshTokenId?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.isActive) {
      throw new UnauthorizedException("Account is inactive");
    }
    const accessToken = this.signAccessToken(user);
    const rawRefresh = randomBytes(48).toString("base64url");
    const tokenHash = createHash("sha256").update(rawRefresh).digest("hex");
    const refreshMs = parseRelativeMs(
      this.config.get<string>("JWT_REFRESH_EXPIRES_IN", "30d"),
      30 * 86_400_000,
    );
    const expiresAt = new Date(Date.now() + refreshMs);

    await this.prisma.$transaction(async (tx) => {
      if (revokeRefreshTokenId) {
        await tx.refreshToken.updateMany({
          where: { id: revokeRefreshTokenId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await tx.refreshToken.create({
        data: { userId, tokenHash, expiresAt },
      });
    });

    return { accessToken, refreshToken: rawRefresh };
  }
}
