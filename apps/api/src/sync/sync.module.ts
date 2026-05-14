import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { TwilioNestModule } from "../integration/twilio.module";
import { SyncService } from "./sync.service";

@Module({
  imports: [PrismaModule, TwilioNestModule],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
