import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseFilters,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AuthService } from "../auth/auth.service";
import {
  resolveSessionCookieRuntime,
  setSessionCookies,
} from "../auth/session-cookie.util";
import { composeE164 } from "../common/phone.util";
import { ApiExceptionFilter } from "../common/filters/api-exception.filter";
import { SendWhatsappOtpDto } from "./dto/send-whatsapp-otp.dto";
import { VerifyWhatsappOtpDto } from "./dto/verify-whatsapp-otp.dto";
import { TwilioOtpService } from "./twilio-otp.service";

/** JSON body of a successful verify (session fields present only when registered). */
type VerifyResponse =
  | {
      verified: true;
      registered: true;
      isOnboarded: boolean;
      userId: string;
      accessToken: string;
      refreshToken: string;
    }
  | { verified: true; registered: false };

@ApiTags("Auth")
@UseFilters(ApiExceptionFilter)
@Controller({ path: "auth/otp/whatsapp", version: "1" })
export class TwilioOtpController {
  constructor(
    private readonly otp: TwilioOtpService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post("send")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Send a 6-digit WhatsApp OTP via the Twilio Authentication template. Code expires in 5 minutes.",
  })
  @ApiOkResponse({
    description: "OTP dispatched to the recipient's WhatsApp.",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
        expiresInSeconds: { type: "number", example: 300 },
        resendAfterSeconds: { type: "number", example: 60 },
      },
    },
  })
  @ApiTooManyRequestsResponse({
    description: "Resend cooldown active; retry after `retryAfterSeconds`.",
  })
  async send(@Body() dto: SendWhatsappOtpDto): Promise<{
    message: string;
    expiresInSeconds: number;
    resendAfterSeconds: number;
  }> {
    const phoneE164 = composeE164(dto.countryCode, dto.phone);
    const result = await this.otp.sendOtp(phoneE164);
    return {
      message: "Verification code sent to your WhatsApp number.",
      ...result,
    };
  }

  @Post("verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Verify a WhatsApp OTP. On success for a registered phone, returns an access token (same claims as WhatsApp login) and sets session cookies. Codes are single-use and expire after 5 minutes.",
  })
  @ApiOkResponse({
    description:
      "Code accepted. When the phone is registered: `{ verified, registered: true, isOnboarded, userId, accessToken, refreshToken }` plus `Set-Cookie` (`cb_access_token`, `cb_refresh_token`, `cb_user_id`). Otherwise `{ verified: true, registered: false }`.",
    schema: {
      type: "object",
      properties: {
        verified: { type: "boolean", example: true },
        registered: { type: "boolean", example: true },
        isOnboarded: { type: "boolean" },
        userId: { type: "string" },
        accessToken: { type: "string" },
        refreshToken: { type: "string" },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description:
      "Code is missing, expired, already used, locked, or incorrect.",
  })
  async verify(
    @Body() dto: VerifyWhatsappOtpDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<VerifyResponse> {
    const phoneE164 = composeE164(dto.countryCode, dto.phone);
    // Throws 401 unless the code matches an active, unexpired, unconsumed OTP.
    await this.otp.verifyOtp(phoneE164, dto.code);

    const session = await this.auth.issueSessionForVerifiedPhone(
      dto.phone,
      dto.countryCode,
    );
    if (!session) {
      return { verified: true, registered: false };
    }

    setSessionCookies(res, session, resolveSessionCookieRuntime(this.config));
    return {
      verified: true,
      registered: true,
      isOnboarded: session.isOnboarded,
      userId: session.userId,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  }
}
