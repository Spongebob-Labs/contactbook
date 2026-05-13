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
import { PrismaService } from "../prisma/prisma.service";
import { PHONE_VERIFICATION_JWT_TYP } from "./auth.constants";
import type { CompleteRegisterDto } from "./dto/complete-register.dto";
import { OtpService } from "./otp.service";
import { parseRelativeMs } from "./parse-relative-ms";

export type VerifyWhatsappCodeResponse =
  | {
      registered: true;
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
   * Sends a WhatsApp OTP for any E.164 number (registered or not). Twilio errors surface as
   * 400 when WhatsApp cannot receive the message.
   */
  async requestWhatsappCode(
    phoneE164: string,
    _countryCode: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { phone: phoneE164 },
    });
    await this.otp.sendPhoneOtp(phoneE164, user?.id ?? null);
    return { message: "Verification code sent to your WhatsApp number." };
  }

  async verifyWhatsappCode(
    phoneE164: string,
    code: string,
  ): Promise<VerifyWhatsappCodeResponse> {
    const userId = await this.otp.verifyPhoneOtp(phoneE164, code);
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new UnauthorizedException();
      }
      const tokens = await this.issueTokenPair(user.id);
      return {
        registered: true,
        userId: user.id,
        ...tokens,
      };
    }
    return {
      registered: false,
      message:
        "No account for this phone number. Register with your name, email, and the same phone number.",
      phoneVerificationToken: this.signPhoneVerificationJwt(phoneE164),
    };
  }

  async completeRegister(
    dto: CompleteRegisterDto,
  ): Promise<{ userId: string; accessToken: string; refreshToken: string }> {
    const phoneFromJwt = this.verifyPhoneVerificationJwt(
      dto.phoneVerificationToken,
    );
    if (phoneFromJwt !== dto.phoneE164) {
      throw new UnauthorizedException(
        "Phone number does not match verification",
      );
    }
    const email = dto.email.trim().toLowerCase();
    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: dto.phoneE164 },
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
        phone: dto.phoneE164,
        name: dto.name.trim(),
        email,
        countryCode: dto.countryCode.toUpperCase(),
        isActive: true,
      },
    });
    const tokens = await this.issueTokenPair(user.id);
    return { userId: user.id, ...tokens };
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
    });
  }

  private signPhoneVerificationJwt(phoneE164: string): string {
    return this.jwt.sign(
      { typ: PHONE_VERIFICATION_JWT_TYP, phoneE164 },
      {
        expiresIn: this.config.get<string>(
          "JWT_PHONE_VERIFY_EXPIRES_IN",
          "10m",
        ) as NonNullable<SignOptions["expiresIn"]>,
      },
    );
  }

  private verifyPhoneVerificationJwt(token: string): string {
    let payload: unknown;
    try {
      payload = this.jwt.verify(token, {
        secret: this.config.get<string>("JWT_SECRET", "change-me-in-production"),
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
      !("phoneE164" in payload)
    ) {
      throw new UnauthorizedException("Invalid phone verification token");
    }
    const p = payload as { typ: unknown; phoneE164: unknown };
    if (
      p.typ !== PHONE_VERIFICATION_JWT_TYP ||
      typeof p.phoneE164 !== "string"
    ) {
      throw new UnauthorizedException("Invalid phone verification token");
    }
    return p.phoneE164;
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
