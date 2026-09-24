import {
  Body,
  Controller,
  Header,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CardConnectService } from './card-connect.service';
import { ConnectOtpRequestDto } from './dto/connect-otp-request.dto';
import { ConnectOtpVerifyDto } from './dto/connect-otp-verify.dto';
import { ConnectSendDto } from './dto/connect-send.dto';

/**
 * The QR-scan "Save & connect" flow — same posture as public-links.controller.ts:
 * no auth guard by design (the caller is an anonymous scanner, not a
 * ContactBook user), excluded from Swagger for the same reason (this is the
 * recipient-facing surface, not the authenticated owner API surface).
 * no-store: this is a live action, never cacheable.
 */
@ApiExcludeController()
@Controller({ path: 'public/links/:token/connect', version: '1' })
export class CardConnectController {
  constructor(private readonly cardConnect: CardConnectService) {}

  @Post('otp/request')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  async requestOtp(
    @Param('token') token: string,
    @Body() dto: ConnectOtpRequestDto,
  ) {
    const result = await this.cardConnect.requestOtp(token, dto.phoneE164);
    return {
      sent: true,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    };
  }

  @Post('otp/verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async verify(
    @Param('token') token: string,
    @Body() dto: ConnectOtpVerifyDto,
  ) {
    return this.cardConnect.verifyAndConnect(token, dto.phoneE164, dto.code);
  }

  /**
   * "Send to my phone" — no OTP round trip. Typed number is trusted as-is
   * and the card goes out over WhatsApp immediately. See
   * CardConnectService's class doc comment for why this is a deliberate,
   * distinct path from otp/verify rather than a shortcut through it.
   */
  @Post('send')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async send(@Param('token') token: string, @Body() dto: ConnectSendDto) {
    return this.cardConnect.connectViaSend(token, dto.phoneE164);
  }
}
