import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import type { VerifyWhatsappCodeResponse } from "./auth.service";
import { CompleteRegisterDto } from "./dto/complete-register.dto";
import { RefreshSessionDto } from "./dto/refresh-session.dto";
import { RequestWhatsappCodeDto } from "./dto/request-whatsapp-code.dto";
import { VerifyWhatsappCodeDto } from "./dto/verify-whatsapp-code.dto";

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
    return this.auth.requestWhatsappCode(dto.phoneE164, dto.countryCode);
  }

  @Post("whatsapp/verify-code")
  @ApiOperation({
    summary:
      "Verify WhatsApp OTP. Returns tokens if the phone is registered; otherwise a short-lived token to complete registration.",
  })
  @ApiOkResponse({
    description:
      "Either `{ registered: true, userId, accessToken, refreshToken }` or `{ registered: false, message, phoneVerificationToken }`.",
  })
  async verifyWhatsappCode(
    @Body() dto: VerifyWhatsappCodeDto,
  ): Promise<VerifyWhatsappCodeResponse> {
    return this.auth.verifyWhatsappCode(dto.phoneE164, dto.code);
  }

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Complete registration after OTP (use `phoneVerificationToken` from verify-code when not registered).",
  })
  @ApiCreatedResponse({
    description: "User created; returns user id and token pair.",
  })
  async completeRegister(
    @Body() dto: CompleteRegisterDto,
  ): Promise<{ userId: string; accessToken: string; refreshToken: string }> {
    return this.auth.completeRegister(dto);
  }

  @Post("refresh")
  @ApiOperation({
    summary: "Exchange a refresh token for a new access + refresh token pair (rotation).",
  })
  @ApiOkResponse({ description: "New access and refresh tokens." })
  async refresh(
    @Body() dto: RefreshSessionDto,
  ): Promise<{ userId: string; accessToken: string; refreshToken: string }> {
    return this.auth.refreshSession(dto.refreshToken);
  }
}
