import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Storage } from "@google-cloud/storage";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

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
 * Generic GCS bucket helper. When GCS_HMAC_ACCESS_KEY_ID + GCS_HMAC_SECRET are
 * set, uses the GCS S3-compatible API with HMAC authentication (avoids needing
 * the VM's service account to have the storage OAuth scope). Falls back to ADC
 * (metadata server / GOOGLE_APPLICATION_CREDENTIALS / GCS_SERVICE_ACCOUNT_KEY_BASE64).
 */
@Injectable()
export class GcsUploadService {
  private readonly storage: Storage | null = null;
  private readonly s3: S3Client | null = null;

  constructor(private readonly config: ConfigService) {
    const hmacKeyId = this.config.get<string>("GCS_HMAC_ACCESS_KEY_ID");
    const hmacSecret = this.config.get<string>("GCS_HMAC_SECRET");

    if (hmacKeyId && hmacSecret) {
      this.s3 = new S3Client({
        endpoint: "https://storage.googleapis.com",
        region: "us-east-1",
        credentials: { accessKeyId: hmacKeyId, secretAccessKey: hmacSecret },
        forcePathStyle: true,
      });
    } else {
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
    const cacheControl =
      options?.cacheControl ?? "public, max-age=31536000, immutable";

    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: buffer,
          ContentType: mimeType,
          CacheControl: cacheControl,
          ...(options?.contentDisposition
            ? { ContentDisposition: options.contentDisposition }
            : {}),
        }),
      );
      return;
    }

    const bucket = this.storage!.bucket(bucketName);
    const file = bucket.file(objectKey);
    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType: mimeType,
        cacheControl,
        ...(options?.contentDisposition
          ? { contentDisposition: options.contentDisposition }
          : {}),
      },
    });
  }

  /** No-ops (does not throw) if the object doesn't exist. */
  async delete(bucketName: string, objectKey: string): Promise<void> {
    if (this.s3) {
      try {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey }),
        );
      } catch (err) {
        const code =
          err && typeof err === "object" && "Code" in err
            ? (err as { Code: string }).Code
            : undefined;
        if (code === "NoSuchKey") return;
        throw err;
      }
      return;
    }

    try {
      await this.storage!.bucket(bucketName).file(objectKey).delete();
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code: number }).code
          : undefined;
      if (code === 404) return;
      throw err;
    }
  }
}
