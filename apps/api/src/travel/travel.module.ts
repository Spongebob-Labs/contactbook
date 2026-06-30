import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { IntegrationModule } from "../integration/integration.module";
import { WhatsappModule } from "../messaging/whatsapp.module";
import { OAuthTokensModule } from "../oauth-tokens/oauth-tokens.module";
import { TravelController } from "./travel.controller";
import { TravelCronService } from "./travel-cron.service";
import { TravelService } from "./travel.service";

@Module({
  imports: [PrismaModule, IntegrationModule, WhatsappModule, OAuthTokensModule],
  controllers: [TravelController],
  providers: [TravelCronService, TravelService],
  exports: [TravelService],
})
export class TravelModule {}
