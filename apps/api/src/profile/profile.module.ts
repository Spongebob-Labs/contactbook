import { Module } from "@nestjs/common";
import { SyncModule } from "../sync/sync.module";
import { ProfileController } from "./profile.controller";
import { ProfileMeSerializerService } from "./profile-me.serializer";
import { ProfileService } from "./profile.service";

@Module({
  imports: [SyncModule],
  controllers: [ProfileController],
  providers: [ProfileService, ProfileMeSerializerService],
  exports: [ProfileService, ProfileMeSerializerService],
})
export class ProfileModule {}
