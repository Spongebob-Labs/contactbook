import { Module } from "@nestjs/common";
import { SyncModule } from "../sync/sync.module";
import { ProfileController } from "./profile.controller";
import { ProfileMeSerializerService } from "./profile-me.serializer";
import { ProfileMeUpsertService } from "./profile-me.upsert.service";
import { ProfilePersistenceService } from "./profile-persistence.service";

@Module({
  imports: [SyncModule],
  controllers: [ProfileController],
  providers: [
    ProfilePersistenceService,
    ProfileMeSerializerService,
    ProfileMeUpsertService,
  ],
  exports: [ProfileMeSerializerService],
})
export class ProfileModule {}
