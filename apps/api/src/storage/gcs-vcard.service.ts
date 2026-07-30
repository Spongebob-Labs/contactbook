import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GcsUploadService, normalizePublicBaseUrl } from "./gcs-upload.service";

// `text/vcard` and `text/directory` are MMS-only per Twilio's accepted MIME types
// (twilio.com/docs/messaging/guides/accepted-mime-types) — WhatsApp only accepts
// `text/x-vcard`. Serving the wrong one gets silently policy-rejected (Twilio error
// 63013), not a clear "bad content-type" error, so this is easy to get wrong.
const VCARD_MIME_TYPE = "text/x-vcard";

/**
 * Hosts generated .vcf card-share files at a public URL so Twilio's WhatsApp document
 * header can fetch them. Uses its own bucket/base-URL pair (GCS_PUBLIC_BASE_URL bakes in
 * the profile-photos bucket name, so it can't be reused here) and content-addressed keys
 * supplied by the caller, unlike profile photos' server-generated UUID keys.
 */
@Injectable()
export class GcsVcardService {
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

  buildPublicUrl(objectKey: string): string {
    return this.gcsUpload.buildPublicUrl(this.publicBaseUrl, objectKey);
  }

  /** `objectKey` is caller-supplied and content-addressed (e.g. `{cardId}/{contentHash}.vcf`). */
  async upload(objectKey: string, buffer: Buffer): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("GCS card-share storage is not configured");
    }
    await this.gcsUpload.upload(this.bucketName, objectKey, buffer, VCARD_MIME_TYPE, {
      cacheControl: "public, max-age=31536000, immutable",
    });
    return this.buildPublicUrl(objectKey);
  }
}
