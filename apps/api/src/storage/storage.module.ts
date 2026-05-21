import { Module } from "@nestjs/common";
import { GcsProfilePhotoService } from "./gcs-profile-photo.service";

@Module({
  providers: [GcsProfilePhotoService],
  exports: [GcsProfilePhotoService],
})
export class StorageModule {}
