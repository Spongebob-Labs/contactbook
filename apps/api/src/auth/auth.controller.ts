import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { SendPhoneOtpDto } from "./dto/send-phone-otp.dto";
import { VerifyPhoneOtpDto } from "./dto/verify-phone-otp.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";

@ApiTags("Auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Register and receive JWT" })
  async register(@Body() dto: RegisterDto): Promise<{ accessToken: string }> {
    return this.auth.register(dto.email, dto.password, dto.name);
  }

  @Post("login")
  @ApiOperation({ summary: "Login and receive JWT" })
  async login(@Body() dto: LoginDto): Promise<{ accessToken: string }> {
    return this.auth.login(dto.email, dto.password);
  }

  @Post("phone/send-otp")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Send WhatsApp OTP for phone verification" })
  async sendPhoneOtp(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: SendPhoneOtpDto,
  ): Promise<{ ok: true }> {
    await this.auth.sendPhoneOtp(user.sub, dto.phoneE164);
    return { ok: true };
  }

  @Post("phone/verify-otp")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Verify OTP and mark phone verified" })
  async verifyPhoneOtp(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: VerifyPhoneOtpDto,
  ): Promise<{ ok: true }> {
    await this.auth.verifyPhoneOtp(user.sub, dto.phoneE164, dto.code);
    return { ok: true };
  }
}
