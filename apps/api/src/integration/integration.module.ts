import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { OAuthTokensModule } from "../oauth-tokens/oauth-tokens.module";
import { TwilioNestModule } from "./twilio.module";
import { GoogleController } from "./google.controller";
import { GoogleService } from "./google.service";
import { TwilioWebhookController } from "./twilio-webhook.controller";
import { WhatsappWebhookService } from "./whatsapp-webhook.service";

@Module({
  imports: [
    PrismaModule,
    TwilioNestModule,
    ConfigModule,
    OAuthTokensModule,
  ],
  controllers: [GoogleController, TwilioWebhookController],
  providers: [GoogleService, WhatsappWebhookService],
  exports: [GoogleService, TwilioNestModule],
})
export class IntegrationModule {}
