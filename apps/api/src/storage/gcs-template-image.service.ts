import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GcsUploadService, normalizePublicBaseUrl } from "./gcs-upload.service";

/**
 * Hosts WhatsApp template header images (user-created share templates). Lives in the
 * card-shares bucket under templates/ — the image URL is baked into the Twilio template
 * at creation time, so it must stay publicly readable for the template's lifetime.
 */
@Injectable()
export class GcsTemplateImageService {
  private readonly bucketName: string;
  private readonly publicBaseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly gcsUpload: GcsUploadService,
  ) {
    this.bucketName = this.config.get<string>("GCS_CARD_SHARES_BUCKET") ?? "";
    this.publicBaseUrl = normalizePublicBaseUrl(
      this.config.get<string>("GCS_CARD_SHARES_PUBLIC_BASE_URL") ?? "",
    );
  }

  isConfigured(): boolean {
    return this.bucketName.length > 0 && this.publicBaseUrl.length > 0;
  }

  extensionForMime(mimeType: string): string | null {
    // Header images only — WhatsApp accepts jpeg/png (webp is converted client-side).
    const ext = this.gcsUpload.extensionForMime(mimeType);
    return ext === "vcf" ? null : ext;
  }

  async upload(
    templateKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("GCS card-share storage is not configured");
    }
    const ext = this.extensionForMime(mimeType);
    if (!ext) {
      throw new Error(`Unsupported image mime type: ${mimeType}`);
    }
    const objectKey = `templates/${templateKey}.${ext}`;
    await this.gcsUpload.upload(this.bucketName, objectKey, buffer, mimeType);
    return this.gcsUpload.buildPublicUrl(this.publicBaseUrl, objectKey);
  }
}
