import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TwilioInboundController } from './twilio-inbound.controller';
import { InboundMessagesController } from './inbound-messages.controller';
import { WebhooksService } from './webhooks.service';
import { TwilioSignatureGuard } from './twilio-signature.guard';

@Module({
  imports: [AuthModule], // for JwtAuthGuard on InboundMessagesController
  controllers: [TwilioInboundController, InboundMessagesController],
  providers: [WebhooksService, TwilioSignatureGuard],
})
export class WebhooksModule {}
