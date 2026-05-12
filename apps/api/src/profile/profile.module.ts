import { Module } from "@nestjs/common";
import { TwilioNestModule } from "../integration/twilio.module";
import { SyncModule } from "../sync/sync.module";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

@Module({
  imports: [SyncModule, TwilioNestModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
