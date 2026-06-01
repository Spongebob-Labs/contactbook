import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseFilters,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import type {
  VerifyWhatsappCodeResponse,
  VerifyWhatsappCodeResult,
} from "./auth.service";
import { CompleteRegisterDto } from "./dto/complete-register.dto";
import { RefreshSessionDto } from "./dto/refresh-session.dto";
import { RequestWhatsappCodeDto } from "./dto/request-whatsapp-code.dto";
import { VerifyWhatsappCodeDto } from "./dto/verify-whatsapp-code.dto";
import {
  CB_REFRESH_TOKEN_COOKIE,
  clearSessionCookies,
  getCookieFromHeader,
  resolveSessionCookieRuntime,
  setSessionCookies,
} from "./session-cookie.util";
import { ApiExceptionFilter } from "../common/filters/api-exception.filter";

@ApiTags("Auth")
@UseFilters(ApiExceptionFilter)
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private sessionCookieRuntime() {
    return resolveSessionCookieRuntime(this.config);
  }

  @Post("whatsapp/request-code")
  @ApiOperation({
    summary:
      "Send WhatsApp OTP to the given phone (registered or not). Requires WhatsApp on the device.",
  })
  @ApiOkResponse({
    description: "OTP dispatched (or dry-run when Twilio is unset).",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
    },
  })
  async requestWhatsappCode(
    @Body() dto: RequestWhatsappCodeDto,
  ): Promise<{ message: string }> {
    return this.auth.requestWhatsappCode(dto.phone, dto.countryCode);
  }

  @Post("whatsapp/verify-code")
  @ApiOperation({
    summary:
      "Verify WhatsApp OTP. Sets httpOnly session cookies if the phone is registered; otherwise returns a short-lived token in the JSON body to complete registration.",
  })
  @ApiOkResponse({
    description:
      "Either `{ registered: true, isOnboarded }` with `Set-Cookie` (`cb_access_token`, `cb_refresh_token`, `cb_user_id`), or `{ registered: false, message, phoneVerificationToken }`.",
    schema: {
      type: "object",
      properties: {
        registered: { type: "boolean" },
        isOnboarded: {
          type: "boolean",
          description:
            "Present when registered is true. True after POST /profile/onboarding completed.",
        },
        message: { type: "string" },
        phoneVerificationToken: { type: "string" },
      },
    },
  })
  async verifyWhatsappCode(
    @Body() dto: VerifyWhatsappCodeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<VerifyWhatsappCodeResponse> {
    const result: VerifyWhatsappCodeResult = await this.auth.verifyWhatsappCode(
      dto.phone,
      dto.countryCode,
      dto.code,
    );
    if (result.registered) {
      setSessionCookies(res, result, this.sessionCookieRuntime());
      return { registered: true, isOnboarded: result.isOnboarded };
    }
    return result;
  }

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Complete registration after OTP (use `phoneVerificationToken` from verify-code when not registered).",
  })
  @ApiCreatedResponse({
    description:
      "User created; empty JSON body `{}`. Session cookies set via `Set-Cookie` (`cb_access_token`, `cb_refresh_token`, `cb_user_id`).",
    schema: {
      type: "object",
      properties: {},
    },
  })
  async completeRegister(
    @Body() dto: CompleteRegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, never>> {
    const session = await this.auth.completeRegister(dto);
    setSessionCookies(res, session, this.sessionCookieRuntime());
    return {};
  }

  @Post("refresh")
  @ApiOperation({
    summary:
      "Rotate refresh token and issue a new access token. Reads `cb_refresh_token` cookie first, then optional body `refreshToken` (for API clients).",
  })
  @ApiOkResponse({
    description:
      "Empty JSON body `{}`. New session cookies set via `Set-Cookie` (`cb_access_token`, `cb_refresh_token`, `cb_user_id`).",
    schema: {
      type: "object",
      properties: {},
    },
  })
  async refresh(
    @Body() dto: RefreshSessionDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, never>> {
    const fromCookie = getCookieFromHeader(
      req.headers.cookie,
      CB_REFRESH_TOKEN_COOKIE,
    );
    const refreshRaw = fromCookie ?? dto.refreshToken;
    if (!refreshRaw) {
      throw new BadRequestException(
        "Refresh token required in cb_refresh_token cookie or request body",
      );
    }
    const session = await this.auth.refreshSession(refreshRaw);
    setSessionCookies(res, session, this.sessionCookieRuntime());
    return {};
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Clear session cookies and revoke the current refresh token when `cb_refresh_token` is present.",
  })
  @ApiOkResponse({
    description: "`{ ok: true }`. Session cookies cleared.",
    schema: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
      },
    },
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const runtime = this.sessionCookieRuntime();
    const refresh = getCookieFromHeader(
      req.headers.cookie,
      CB_REFRESH_TOKEN_COOKIE,
    );
    await this.auth.logoutByRefreshToken(refresh);
    clearSessionCookies(res, runtime);
    return { ok: true };
  }
}
