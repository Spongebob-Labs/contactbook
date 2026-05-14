import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { TwilioNestModule } from "./twilio.module";
import { ContactImportController } from "./contact-import.controller";
import { ContactImportService } from "./contact-import.service";
import { GoogleController } from "./google.controller";
import { GoogleService } from "./google.service";
import { TwilioWebhookController } from "./twilio-webhook.controller";
import { WhatsappWebhookService } from "./whatsapp-webhook.service";

@Module({
  imports: [
    PrismaModule,
    TwilioNestModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET", "change-me-in-production"),
        signOptions: {
          expiresIn: 60 * 60 * 24 * 7,
        },
      }),
    }),
  ],
  controllers: [
    GoogleController,
    ContactImportController,
    TwilioWebhookController,
  ],
  providers: [GoogleService, ContactImportService, WhatsappWebhookService],
  exports: [GoogleService, ContactImportService, TwilioNestModule],
})
export class IntegrationModule {}
