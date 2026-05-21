import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { GcsProfilePhotoService } from "../storage/gcs-profile-photo.service";
import { ProfileMeSerializerService } from "./profile-me.serializer";
import { ProfileMeUpsertService } from "./profile-me.upsert.service";

export const PROFILE_PHOTO_MAX_BYTES = 1_048_576;

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ProfilePhotoUploadResult = {
  profilePhoto: string;
};

@Injectable()
export class ProfilePhotoService {
  constructor(
    private readonly gcs: GcsProfilePhotoService,
    private readonly profileUpsert: ProfileMeUpsertService,
    private readonly profileSerializer: ProfileMeSerializerService,
  ) {}

  async upload(
    userId: string,
    file: Express.Multer.File,
  ): Promise<ProfilePhotoUploadResult> {
    this.assertConfigured();
    this.validateFile(file);

    const profile = await this.profileSerializer.build(userId);
    const previousUrl = profile.identity.profilePhoto ?? null;

    const url = await this.gcs.upload(userId, file.buffer, file.mimetype);

    try {
      await this.profileUpsert.patch(userId, {
        identity: { profilePhoto: url },
      });
    } catch (err) {
      await this.gcs.deleteByUrl(url);
      throw err;
    }

    if (previousUrl && previousUrl !== url) {
      await this.gcs.deleteByUrl(previousUrl);
    }

    return { profilePhoto: url };
  }

  async remove(userId: string): Promise<{ profilePhoto: null }> {
    this.assertConfigured();

    const profile = await this.profileSerializer.build(userId);
    const previousUrl = profile.identity.profilePhoto ?? null;

    await this.profileUpsert.patch(userId, {
      identity: { profilePhoto: null },
    });

    if (previousUrl) {
      await this.gcs.deleteByUrl(previousUrl);
    }

    return { profilePhoto: null };
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
      throw new BadRequestException("file must be 1 MB or smaller");
    }
    if (!this.gcs.extensionForMime(file.mimetype)) {
      throw new BadRequestException("unsupported image type");
    }
  }
}
