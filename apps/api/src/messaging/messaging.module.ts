import { Module } from '@nestjs/common';
import { TwilioClient } from './twilio-client';
import { WhatsappService } from './whatsapp.service';

@Module({
  providers: [TwilioClient, WhatsappService],
  exports: [WhatsappService, TwilioClient],
})
export class MessagingModule {}
