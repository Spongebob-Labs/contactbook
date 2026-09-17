import {
  Injectable,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Storage } from '@google-cloud/storage';
import { AppConfigService } from '../config/app-config.service';
import { ApiError } from '../common/errors/api-error';

export const MAX_LOGO_BYTES = 20 * 1024 * 1024; // 20 MiB — same cap as profile photos

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Same shape as ProfilePhotoStorageService (profile/profile-photo-storage.service.ts)
 * — deliberately its own file rather than a shared base class, matching this
 * codebase's own convention of small per-domain duplication over a
 * cross-cutting abstraction (see e.g. the several independent isP2002()
 * helpers across sharing/webhooks).
 *
 * Uploads to a bucket with uniform bucket-level access and `allUsers`
 * granted `objectViewer` — public-read by design, since a card logo has to
 * render on the public share page. No signed URLs, no per-object ACL calls.
 * Uses Application Default Credentials — no key file, same as the photo
 * service.
 *
 * Falls back to the profile-photos bucket when no dedicated
 * GCS_CARD_LOGOS_BUCKET is configured — see AppConfigService.gcs — so the
 * common case is one shared public-read bucket, objects distinguished by
 * the `card-logos/` key prefix below.
 */
@Injectable()
export class CardLogoStorageService {
  private readonly storage = new Storage();

  constructor(private readonly config: AppConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.gcs.cardLogosBucket);
  }

  /** Validates from the actual file bytes' declared mimetype and size, then
   *  uploads and returns the public URL. Does not touch the database — the
   *  caller owns writing the resulting URL into Card.logoUrl. */
  async upload(
    cardId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<string> {
    const bucketName = this.config.gcs.cardLogosBucket;
    if (!bucketName) {
      throw ApiError.conflict(
        'LOGO_STORAGE_NOT_CONFIGURED',
        'Card logo storage is not configured.',
      );
    }

    if (file.size > MAX_LOGO_BYTES) {
      throw new PayloadTooLargeException({
        code: 'LOGO_TOO_LARGE',
        message: `Logo exceeds the ${MAX_LOGO_BYTES / (1024 * 1024)} MB limit.`,
      });
    }

    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw new UnsupportedMediaTypeException({
        code: 'LOGO_TYPE_UNSUPPORTED',
        message: 'Only JPEG, PNG, or WebP images are accepted.',
      });
    }

    // Prefixed with card-logos/ and the cardId — distinguishes these
    // objects from profile photos when both share a bucket (the default),
    // and keeps one card's uploads from colliding with another's.
    const objectKey = `card-logos/${cardId}/${randomUUID()}.${ext}`;
    const bucket = this.storage.bucket(bucketName);

    await bucket.file(objectKey).save(file.buffer, {
      contentType: file.mimetype,
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      resumable: false,
    });

    return `${this.config.gcs.publicBaseUrl}/${objectKey}`;
  }

  /** Best-effort. A failed delete leaves an orphaned object in the bucket —
   *  acceptable (cheap, unlisted storage), not acceptable to fail the
   *  request that's replacing or removing the card's logo over it. */
  async deleteByUrl(url: string): Promise<void> {
    const bucketName = this.config.gcs.cardLogosBucket;
    const baseUrl = this.config.gcs.publicBaseUrl;
    if (!bucketName || !baseUrl || !url.startsWith(`${baseUrl}/`)) return;

    const objectKey = url.slice(baseUrl.length + 1);
    try {
      await this.storage
        .bucket(bucketName)
        .file(objectKey)
        .delete({ ignoreNotFound: true });
    } catch {
      // logged by the caller if it wants to; deletion failures here are not
      // fatal to whatever action triggered the replace/remove.
    }
  }
}
