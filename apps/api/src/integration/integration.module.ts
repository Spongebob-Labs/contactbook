import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ConnectionModule } from "../connection/connection.module";
import { PrismaModule } from "../prisma/prisma.module";
import { OAuthTokensModule } from "../oauth-tokens/oauth-tokens.module";
import { WhatsappModule } from "../messaging/whatsapp.module";
import { GoogleController } from "./google.controller";
import { GoogleService } from "./google.service";
import { OpenWaWebhookController } from "./openwa-webhook.controller";
import { WhatsappWebhookService } from "./whatsapp-webhook.service";
import { WebhookDlqService } from "./webhook-dlq.service";

@Module({
  imports: [
    PrismaModule,
    WhatsappModule,
    ConfigModule,
    OAuthTokensModule,
    ConnectionModule,
  ],
  controllers: [GoogleController, OpenWaWebhookController],
  providers: [GoogleService, WhatsappWebhookService, WebhookDlqService],
  exports: [GoogleService, WhatsappModule],
})
export class IntegrationModule {}
