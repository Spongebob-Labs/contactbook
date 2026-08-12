import { Module } from "@nestjs/common";
import { GcsProfilePhotoService } from "./gcs-profile-photo.service";
import { GcsTemplateImageService } from "./gcs-template-image.service";
import { GcsUploadService } from "./gcs-upload.service";
import { GcsVcardService } from "./gcs-vcard.service";

@Module({
  providers: [
    GcsUploadService,
    GcsProfilePhotoService,
    GcsVcardService,
    GcsTemplateImageService,
  ],
  exports: [
    GcsUploadService,
    GcsProfilePhotoService,
    GcsVcardService,
    GcsTemplateImageService,
  ],
})
export class StorageModule {}
