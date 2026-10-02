import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { TwilioInboundController } from './twilio-inbound.controller';
import { InboundMessagesController } from './inbound-messages.controller';
import { WebhooksService } from './webhooks.service';
import { BotService } from './bot.service';
import { TwilioSignatureGuard } from './twilio-signature.guard';

@Module({
  imports: [
    AuthModule, // for JwtAuthGuard on InboundMessagesController
    MessagingModule, // for TwilioClient used by BotService
  ],
  controllers: [TwilioInboundController, InboundMessagesController],
  providers: [WebhooksService, BotService, TwilioSignatureGuard],
})
export class WebhooksModule {}
