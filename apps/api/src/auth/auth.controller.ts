import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { ApiError } from '../common/errors/api-error';
import { ApiErrorResponseDto } from '../common/errors/api-error-response.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import {
  AuthMeResponseDto,
  OkResponseDto,
  RefreshResponseDto,
  RequestOtpResponseDto,
  VerifyOtpResponseDto,
} from './dto/auth-responses.dto';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import {
  clearAuthCookies,
  readAuthCookie,
  setAuthCookies,
} from './auth-cookies.util';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('otp/request')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Request a WhatsApp OTP',
    description:
      'Always 202 on a well-formed number — this never reveals whether an account already ' +
      'exists for that phone. Rate-limited per phone: a 60s cooldown between requests, and a ' +
      '5-per-hour cap (see OTP_COOLDOWN / OTP_RATE_LIMITED below).',
  })
  @ApiResponse({ status: 202, type: RequestOtpResponseDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorResponseDto,
    description:
      'OTP_COOLDOWN (resend too soon) or OTP_RATE_LIMITED (5/hour exceeded).',
  })
  async requestOtp(@Body() dto: RequestOtpDto) {
    const result = await this.otp.request(dto.phoneE164);
    // devCode is only ever present outside production with Twilio
    // unconfigured — see OtpService. It is never logged.
    return {
      sent: true,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    };
  }

  @Post('otp/verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify an OTP and sign in',
    description:
      'Creates the User on first-ever verification for a phone number (passwordless signup ' +
      'and login are the same operation). On success, sets httpOnly cb_access_token and ' +
      'cb_refresh_token cookies AND returns the access token in the body — every endpoint ' +
      'accepts either the cookie or an Authorization: Bearer header, so a non-browser client ' +
      'can authenticate purely off this response with no cookie jar at all.',
  })
  @ApiResponse({ status: 200, type: VerifyOtpResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description:
      'OTP_NOT_FOUND — no active (unexpired, unconsumed) code for this number.',
  })
  @ApiResponse({
    status: 409,
    type: ApiErrorResponseDto,
    description:
      'OTP_INVALID (wrong code) or OTP_ATTEMPTS_EXCEEDED (5 wrong guesses — even the correct code is now rejected; request a new one).',
  })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { userId } = await this.otp.verify(dto.phoneE164, dto.code);
    const [issued, user] = await Promise.all([
      this.tokens.issueForUser(userId, dto.phoneE164),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);
    setAuthCookies(res, this.config, issued);
    return {
      userId,
      accessToken: issued.accessToken,
      isOnboardingCompleted: user.profileOnboardingCompletedAt !== null,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Rotate the session',
    description:
      'Body is optional and normally omitted — the refresh token is read from the ' +
      'cb_refresh_token cookie. Reusing an already-rotated token revokes the whole token ' +
      'family (REFRESH_REUSE_DETECTED), not just the presented token — this is the reuse-of-a-' +
      'stolen-token detection. Returns a fresh access token in the body, same as ' +
      '/auth/otp/verify.',
  })
  @ApiResponse({ status: 200, type: RefreshResponseDto })
  @ApiResponse({
    status: 403,
    type: ApiErrorResponseDto,
    description:
      'REFRESH_MISSING, REFRESH_INVALID (expired/unknown), or REFRESH_REUSE_DETECTED.',
  })
  async refresh(
    @Body() body: Partial<RefreshDto>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // body is `undefined`, not `{}`, when the client sends no body at all —
    // which is the normal case here, since the token usually comes from the
    // cookie rather than a JSON payload.
    const presented =
      body?.refreshToken ?? readAuthCookie(req, 'cb_refresh_token');
    if (!presented) {
      throw ApiError.forbidden('REFRESH_MISSING', 'No refresh token provided.');
    }
    const issued = await this.tokens.rotate(presented);
    setAuthCookies(res, this.config, issued);
    return { accessToken: issued.accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sign out',
    description:
      'Revokes the refresh token family and clears both auth cookies.',
  })
  @ApiResponse({ status: 200, type: OkResponseDto })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = readAuthCookie(req, 'cb_refresh_token');
    if (presented) await this.tokens.revokeFamily(presented);
    clearAuthCookies(res, this.config);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('cb_access_token')
  @ApiOperation({
    summary: 'Check whether the caller is signed in',
    description:
      'Accepts the access token either as the cb_access_token cookie or an Authorization: ' +
      "Bearer header. Returns only the token's identity claims — id and phoneE164. For the " +
      "owner's actual profile data (name, email, onboarding status, fields), use " +
      'GET /profile/me instead; auth stays scoped to "who is this token for", not "what do ' +
      'we know about them".',
  })
  @ApiResponse({ status: 200, type: AuthMeResponseDto })
  @ApiResponse({
    status: 401,
    type: ApiErrorResponseDto,
    description: 'UNAUTHENTICATED — missing, invalid, or expired token.',
  })
  async me(@Req() req: Request) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
    });
    return {
      id: user.id,
      phoneE164: user.phoneE164,
      isOnboardingCompleted: user.profileOnboardingCompletedAt !== null,
    };
  }
}
