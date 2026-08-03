import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Storage } from "@google-cloud/storage";

export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "text/x-vcard": "vcf",
};

export function normalizePublicBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

export type GcsUploadOptions = {
  cacheControl?: string;
  contentDisposition?: string;
};

/**
 * Generic GCS bucket helper shared by every feature that needs to host a file at a public
 * URL (profile photos, card-share .vcf files, ...). Bucket name and public base URL are
 * passed per-call rather than baked into the instance, since this is a single DI-managed
 * singleton shared across multiple buckets.
 */
@Injectable()
export class GcsUploadService {
  private readonly storage: Storage;

  constructor(private readonly config: ConfigService) {
    const projectId = this.config.get<string>("GCS_PROJECT_ID");
    const keyBase64 = this.config.get<string>("GCS_SERVICE_ACCOUNT_KEY_BASE64");
    const credentials = keyBase64
      ? JSON.parse(Buffer.from(keyBase64, "base64").toString("utf-8"))
      : undefined;
    this.storage = new Storage({
      ...(projectId ? { projectId } : {}),
      ...(credentials ? { credentials } : {}),
    });
  }

  extensionForMime(mimeType: string): string | null {
    return MIME_TO_EXT[mimeType] ?? null;
  }

  buildPublicUrl(publicBaseUrl: string, objectKey: string): string {
    return `${normalizePublicBaseUrl(publicBaseUrl)}/${objectKey}`;
  }

  async upload(
    bucketName: string,
    objectKey: string,
    buffer: Buffer,
    mimeType: string,
    options?: GcsUploadOptions,
  ): Promise<void> {
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(objectKey);
    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType: mimeType,
        cacheControl:
          options?.cacheControl ?? "public, max-age=31536000, immutable",
        ...(options?.contentDisposition
          ? { contentDisposition: options.contentDisposition }
          : {}),
      },
    });
  }

  /** No-ops (does not throw) if the object doesn't exist. */
  async delete(bucketName: string, objectKey: string): Promise<void> {
    try {
      await this.storage.bucket(bucketName).file(objectKey).delete();
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code: number }).code
          : undefined;
      if (code === 404) {
        return;
      }
      throw err;
    }
  }
}
