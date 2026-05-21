import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { SyncModule } from "../sync/sync.module";
import { ProfileController } from "./profile.controller";
import { ProfileMeSerializerService } from "./profile-me.serializer";
import { ProfileMeUpsertService } from "./profile-me.upsert.service";
import { ProfilePersistenceService } from "./profile-persistence.service";
import { ProfilePhotoService } from "./profile-photo.service";

@Module({
  imports: [SyncModule, StorageModule],
  controllers: [ProfileController],
  providers: [
    ProfilePersistenceService,
    ProfileMeSerializerService,
    ProfileMeUpsertService,
    ProfilePhotoService,
  ],
  exports: [ProfileMeSerializerService],
})
export class ProfileModule {}
