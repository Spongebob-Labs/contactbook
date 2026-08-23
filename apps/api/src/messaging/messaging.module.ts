import { Module } from '@nestjs/common';
import { TwilioClient } from './twilio-client';
import { WhatsappService } from './whatsapp.service';
import { WhatsAppTemplateService } from './whatsapp-template.service';

// No controller here, deliberately: WhatsAppTemplateController lives in
// SharingModule instead. This module already needs to be importable by
// AuthModule (for OTP sending) — giving it its own controller would mean
// importing AuthModule for JwtAuthGuard, and AuthModule already imports
// THIS module, which is a circular import Nest would need a forwardRef to
// break. Easier to just not create the cycle.
@Module({
  providers: [TwilioClient, WhatsappService, WhatsAppTemplateService],
  exports: [WhatsappService, TwilioClient, WhatsAppTemplateService],
})
export class MessagingModule {}
