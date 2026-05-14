import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  CONTACTBOOK_ACCESS_TOKEN_HEADER,
  CONTACTBOOK_REFRESH_TOKEN_HEADER,
  CONTACTBOOK_USER_ID_HEADER,
} from "./auth.constants";
import { AuthService } from "./auth.service";
import type {
  VerifyWhatsappCodeResponse,
  VerifyWhatsappCodeResult,
} from "./auth.service";
import { CompleteRegisterDto } from "./dto/complete-register.dto";
import { RefreshSessionDto } from "./dto/refresh-session.dto";
import { RequestWhatsappCodeDto } from "./dto/request-whatsapp-code.dto";
import { VerifyWhatsappCodeDto } from "./dto/verify-whatsapp-code.dto";

function setSessionHeaders(
  res: Response,
  session: { userId: string; accessToken: string; refreshToken: string },
): void {
  res.setHeader(CONTACTBOOK_USER_ID_HEADER, session.userId);
  res.setHeader(CONTACTBOOK_ACCESS_TOKEN_HEADER, session.accessToken);
  res.setHeader(CONTACTBOOK_REFRESH_TOKEN_HEADER, session.refreshToken);
}

@ApiTags("Auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("whatsapp/request-code")
  @ApiOperation({
    summary:
      "Send WhatsApp OTP to the given phone (registered or not). Requires WhatsApp on the device.",
  })
  @ApiOkResponse({ description: "OTP dispatched (or dry-run when Twilio is unset)." })
  async requestWhatsappCode(
    @Body() dto: RequestWhatsappCodeDto,
  ): Promise<{ message: string }> {
    return this.auth.requestWhatsappCode(dto.phone, dto.countryCode);
  }

  @Post("whatsapp/verify-code")
  @ApiHeader({
    name: CONTACTBOOK_USER_ID_HEADER,
    description: "Present when the JSON body has `registered: true`.",
  })
  @ApiHeader({
    name: CONTACTBOOK_ACCESS_TOKEN_HEADER,
    description: "JWT access token when `registered: true`.",
  })
  @ApiHeader({
    name: CONTACTBOOK_REFRESH_TOKEN_HEADER,
    description: "Opaque refresh token when `registered: true`.",
  })
  @ApiOperation({
    summary:
      "Verify WhatsApp OTP. Returns session headers if the phone is registered; otherwise a short-lived token to complete registration in the JSON body.",
  })
  @ApiOkResponse({
    description:
      "Either `{ registered: true }` with session headers (`X-Contactbook-*`), or `{ registered: false, message, phoneVerificationToken }`.",
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
      setSessionHeaders(res, result);
      return { registered: true };
    }
    return result;
  }

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({
    name: CONTACTBOOK_USER_ID_HEADER,
    description: "Created user id.",
  })
  @ApiHeader({
    name: CONTACTBOOK_ACCESS_TOKEN_HEADER,
    description: "JWT access token.",
  })
  @ApiHeader({
    name: CONTACTBOOK_REFRESH_TOKEN_HEADER,
    description: "Opaque refresh token.",
  })
  @ApiOperation({
    summary:
      "Complete registration after OTP (use `phoneVerificationToken` from verify-code when not registered).",
  })
  @ApiCreatedResponse({
    description:
      "User created; empty JSON body `{}`. Session credentials are in `X-Contactbook-*` response headers.",
  })
  async completeRegister(
    @Body() dto: CompleteRegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, never>> {
    const session = await this.auth.completeRegister(dto);
    setSessionHeaders(res, session);
    return {};
  }

  @Post("refresh")
  @ApiHeader({
    name: CONTACTBOOK_USER_ID_HEADER,
    description: "User id for the rotated session.",
  })
  @ApiHeader({
    name: CONTACTBOOK_ACCESS_TOKEN_HEADER,
    description: "New JWT access token.",
  })
  @ApiHeader({
    name: CONTACTBOOK_REFRESH_TOKEN_HEADER,
    description: "New opaque refresh token.",
  })
  @ApiOperation({
    summary: "Exchange a refresh token for a new access + refresh token pair (rotation).",
  })
  @ApiOkResponse({
    description:
      "Empty JSON body `{}`. New credentials are in `X-Contactbook-*` response headers.",
  })
  async refresh(
    @Body() dto: RefreshSessionDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, never>> {
    const session = await this.auth.refreshSession(dto.refreshToken);
    setSessionHeaders(res, session);
    return {};
  }
}
