import { Module } from "@nestjs/common";
import { GcsProfilePhotoService } from "./gcs-profile-photo.service";
import { GcsUploadService } from "./gcs-upload.service";
import { GcsVcardService } from "./gcs-vcard.service";

@Module({
  providers: [GcsUploadService, GcsProfilePhotoService, GcsVcardService],
  exports: [GcsUploadService, GcsProfilePhotoService, GcsVcardService],
})
export class StorageModule {}
