import { Module, type OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { MessagingModule } from '../messaging/messaging.module';
import { WhatsappService } from '../messaging/whatsapp.service';
import { TaskHandlerRegistry } from '../outbox/task-handler.registry';
import { AppConfigService } from '../config/app-config.service';
import { ApiError } from '../common/errors/api-error';

@Module({
  imports: [JwtModule.register({}), MessagingModule],
  controllers: [AuthController],
  providers: [OtpService, TokenService, JwtAuthGuard],
  // JwtModule is re-exported alongside the guard: JwtAuthGuard's own
  // constructor needs JwtService, and Nest resolves an exported provider's
  // dependencies from the CONSUMING module's import graph — a module that
  // imports AuthModule only for the guard (e.g. ProfileModule) would
  // otherwise fail to satisfy JwtService with "not available in the X
  // module", since exporting JwtAuthGuard alone doesn't carry its own
  // dependencies along with it.
  //
  // OtpService is exported too: sharing/card-connect.service.ts needs
  // verifyChallenge()/request() to verify a QR-scan connector's phone
  // without creating them a session — the flow AuthController itself never
  // needed to expose outside this module until now.
  exports: [JwtModule, JwtAuthGuard, OtpService],
})
export class AuthModule implements OnModuleInit {
  constructor(
    private readonly registry: TaskHandlerRegistry,
    private readonly whatsapp: WhatsappService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    // The one place that knows how to turn an outbox row of kind
    // 'send_whatsapp_otp' into an actual Twilio call. Registered here rather
    // than in OutboxModule because the outbox has no business knowing what an
    // OTP template looks like — it only knows how to dispatch by `kind`.
    this.registry.register('send_whatsapp_otp', async (payload) => {
      const { phoneE164, challengeId, code } = payload as {
        phoneE164: string;
        challengeId: string;
        code: string;
      };

      const contentSid = this.config.twilio.otpContentSid;
      if (!contentSid) {
        throw ApiError.forbidden(
          'OTP_TEMPLATE_NOT_CONFIGURED',
          'TWILIO_OTP_CONTENT_SID is not set; cannot send OTP messages.',
        );
      }

      const result = await this.whatsapp.sendTemplate({
        purpose: 'OTP',
        toE164: phoneE164,
        contentSid,
        variables: { '1': code },
        correlationId: challengeId,
      });

      if (!result.ok) {
        // Thrown, not swallowed: the outbox's catch block records this as a
        // retryable failure (status back to PENDING) unless the error class
        // says otherwise. OTP sends don't yet branch on errorClass the way
        // card-share retries will — that refinement lands with the outbox
        // sweeper and reaper, not in this first pass.
        throw new Error(result.errorMessage ?? 'WhatsApp send failed');
      }
    });
  }
}
