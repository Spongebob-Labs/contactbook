import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { GcsUploadService, normalizePublicBaseUrl } from "./gcs-upload.service";

export { normalizePublicBaseUrl };

@Injectable()
export class GcsProfilePhotoService {
  private readonly logger = new Logger(GcsProfilePhotoService.name);
  private readonly bucketName: string;
  private readonly publicBaseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly gcsUpload: GcsUploadService,
  ) {
    this.bucketName =
      this.config.get<string>("GCS_PROFILE_PHOTOS_BUCKET") ?? "";
    this.publicBaseUrl = normalizePublicBaseUrl(
      this.config.get<string>("GCS_PUBLIC_BASE_URL") ?? "",
    );
  }

  isConfigured(): boolean {
    return this.bucketName.length > 0 && this.publicBaseUrl.length > 0;
  }

  isManagedUrl(url: string): boolean {
    if (!this.isConfigured()) {
      return false;
    }
    return url.startsWith(`${this.publicBaseUrl}/`);
  }

  objectKeyFromUrl(url: string): string | null {
    if (!this.isManagedUrl(url)) {
      return null;
    }
    const key = url.slice(this.publicBaseUrl.length + 1);
    const parts = key.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return null;
    }
    return key;
  }

  buildPublicUrl(objectKey: string): string {
    return this.gcsUpload.buildPublicUrl(this.publicBaseUrl, objectKey);
  }

  extensionForMime(mimeType: string): string | null {
    return this.gcsUpload.extensionForMime(mimeType);
  }

  async upload(
    userId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("GCS profile photo storage is not configured");
    }
    const ext = this.extensionForMime(mimeType);
    if (!ext) {
      throw new Error(`Unsupported mime type: ${mimeType}`);
    }
    const objectKey = `${userId}/${randomUUID()}.${ext}`;
    await this.gcsUpload.upload(this.bucketName, objectKey, buffer, mimeType);
    return this.buildPublicUrl(objectKey);
  }

  async deleteByUrl(url: string): Promise<void> {
    const objectKey = this.objectKeyFromUrl(url);
    if (!objectKey) {
      return;
    }
    try {
      await this.gcsUpload.delete(this.bucketName, objectKey);
    } catch (err) {
      this.logger.warn(
        `Failed to delete GCS object ${objectKey}: ${String(err)}`,
      );
    }
  }
}
