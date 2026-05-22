import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Storage } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";

const PROFILE_KEY_PREFIX = "profiles/";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

@Injectable()
export class GcsProfilePhotoService {
  private readonly logger = new Logger(GcsProfilePhotoService.name);
  private readonly bucketName: string;
  private readonly publicBaseUrl: string;
  private readonly storage: Storage;

  constructor(private readonly config: ConfigService) {
    this.bucketName =
      this.config.get<string>("GCS_PROFILE_PHOTOS_BUCKET") ?? "";
    this.publicBaseUrl = normalizePublicBaseUrl(
      this.config.get<string>("GCS_PUBLIC_BASE_URL") ?? "",
    );
    const projectId = this.config.get<string>("GCS_PROJECT_ID");
    this.storage = new Storage(projectId ? { projectId } : undefined);
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
    if (!key.startsWith(PROFILE_KEY_PREFIX)) {
      return null;
    }
    return key;
  }

  buildPublicUrl(objectKey: string): string {
    return `${this.publicBaseUrl}/${objectKey}`;
  }

  extensionForMime(mimeType: string): string | null {
    return MIME_TO_EXT[mimeType] ?? null;
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
    const objectKey = `${PROFILE_KEY_PREFIX}${userId}/${randomUUID()}.${ext}`;
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(objectKey);
    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType: mimeType,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    return this.buildPublicUrl(objectKey);
  }

  async deleteByUrl(url: string): Promise<void> {
    const objectKey = this.objectKeyFromUrl(url);
    if (!objectKey) {
      return;
    }
    try {
      await this.storage.bucket(this.bucketName).file(objectKey).delete();
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code: number }).code
          : undefined;
      if (code === 404) {
        return;
      }
      this.logger.warn(
        `Failed to delete GCS object ${objectKey}: ${String(err)}`,
      );
    }
  }
}

export function normalizePublicBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}
