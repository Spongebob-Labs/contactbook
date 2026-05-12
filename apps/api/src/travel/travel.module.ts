import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { IntegrationModule } from "../integration/integration.module";
import { TwilioNestModule } from "../integration/twilio.module";
import { TravelCronService } from "./travel-cron.service";

@Module({
  imports: [PrismaModule, IntegrationModule, TwilioNestModule],
  providers: [TravelCronService],
})
export class TravelModule {}
