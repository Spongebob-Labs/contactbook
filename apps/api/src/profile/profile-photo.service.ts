import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { GcsProfilePhotoService } from "../storage/gcs-profile-photo.service";

export const PROFILE_PHOTO_MAX_BYTES = 20_971_520;

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ProfilePhotoUploadResult = {
  url: string;
};

@Injectable()
export class ProfilePhotoService {
  constructor(private readonly gcs: GcsProfilePhotoService) {}

  async upload(
    userId: string,
    file: Express.Multer.File,
  ): Promise<ProfilePhotoUploadResult> {
    this.assertConfigured();
    this.validateFile(file);

    const url = await this.gcs.upload(userId, file.buffer, file.mimetype);

    return { url };
  }

  async remove(url: string): Promise<{ url: string }> {
    this.assertConfigured();
    if (!url) {
      throw new BadRequestException("url is required");
    }

    await this.gcs.deleteByUrl(url);

    return { url };
  }

  private assertConfigured(): void {
    if (!this.gcs.isConfigured()) {
      throw new ServiceUnavailableException(
        "Profile photo storage is not configured",
      );
    }
  }

  private validateFile(file: Express.Multer.File | undefined): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException("file is required");
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        "file must be image/jpeg, image/png, or image/webp",
      );
    }
    if (file.size > PROFILE_PHOTO_MAX_BYTES) {
      throw new BadRequestException("file must be 20 MB or smaller");
    }
    if (!this.gcs.extensionForMime(file.mimetype)) {
      throw new BadRequestException("unsupported image type");
    }
  }
}
