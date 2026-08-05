import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TwilioOtpClient } from "./twilio-otp.client";
import { TwilioOtpController } from "./twilio-otp.controller";
import { TwilioOtpService } from "./twilio-otp.service";

/**
 * WhatsApp OTP over Twilio's approved Authentication content template.
 * Self-contained: generates + stores codes (bcrypt, 5-min TTL) and delivers
 * them via the Twilio Messages API. Config comes from TWILIO_* env vars.
 *
 * Imports AuthModule so a verified code can mint the same session (access +
 * refresh tokens, cookies) as the primary WhatsApp login.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TwilioOtpController],
  providers: [TwilioOtpService, TwilioOtpClient],
  exports: [TwilioOtpService],
})
export class TwilioOtpModule {}
