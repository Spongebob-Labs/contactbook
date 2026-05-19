import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { OAuthTokensModule } from "../oauth-tokens/oauth-tokens.module";
import { TwilioNestModule } from "./twilio.module";
import { ContactImportController } from "./contact-import.controller";
import { ContactImportService } from "./contact-import.service";
import { GoogleController } from "./google.controller";
import { GoogleService } from "./google.service";
import { TwilioWebhookController } from "./twilio-webhook.controller";
import { WhatsappWebhookService } from "./whatsapp-webhook.service";

@Module({
  imports: [PrismaModule, TwilioNestModule, ConfigModule, OAuthTokensModule],
  controllers: [
    GoogleController,
    ContactImportController,
    TwilioWebhookController,
  ],
  providers: [GoogleService, ContactImportService, WhatsappWebhookService],
  exports: [GoogleService, ContactImportService, TwilioNestModule],
})
export class IntegrationModule {}
