import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { IntegrationModule } from "../integration/integration.module";
import { TwilioNestModule } from "../integration/twilio.module";
import { OAuthTokensModule } from "../oauth-tokens/oauth-tokens.module";
import { TravelCronService } from "./travel-cron.service";

@Module({
  imports: [
    PrismaModule,
    IntegrationModule,
    TwilioNestModule,
    OAuthTokensModule,
  ],
  providers: [TravelCronService],
})
export class TravelModule {}
