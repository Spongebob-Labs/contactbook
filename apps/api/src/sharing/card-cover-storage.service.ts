import {
  Injectable,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Storage } from '@google-cloud/storage';
import { AppConfigService } from '../config/app-config.service';
import { ApiError } from '../common/errors/api-error';

export const MAX_COVER_BYTES = 5 * 1024 * 1024; // 5 MiB — the frontend's own cap, per its crop contract

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Same shape as CardLogoStorageService/ProfilePhotoStorageService —
 * deliberately its own file rather than a shared base class, matching this
 * codebase's convention of small per-domain duplication over a
 * cross-cutting abstraction.
 *
 * ⚠ Stores and serves the bytes it's given, unmodified. The frontend's own
 * crop dialog bakes the owner's exact composition (1:0.7 aspect, ≤1280px
 * long edge) into the file before it ever reaches this service — there is
 * no resize, re-crop, or re-compress step here, and there must never be
 * one. A server-side "smart crop" would silently undo the composition and
 * reintroduce the exact bug this feature exists to fix (a full-length
 * photograph rendering as a head). If a transcode is ever needed for CDN
 * reasons, it must preserve the aspect ratio exactly.
 *
 * Falls back to the profile-photos bucket when no dedicated
 * GCS_CARD_COVERS_BUCKET is configured — see AppConfigService.gcs.
 */
@Injectable()
export class CardCoverStorageService {
  private readonly storage = new Storage();

  constructor(private readonly config: AppConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.gcs.cardCoversBucket);
  }

  async upload(
    cardId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<string> {
    const bucketName = this.config.gcs.cardCoversBucket;
    if (!bucketName) {
      throw ApiError.conflict(
        'COVER_STORAGE_NOT_CONFIGURED',
        'Card cover storage is not configured.',
      );
    }

    if (file.size > MAX_COVER_BYTES) {
      throw new PayloadTooLargeException({
        code: 'COVER_TOO_LARGE',
        message: `Cover exceeds the ${MAX_COVER_BYTES / (1024 * 1024)} MB limit.`,
      });
    }

    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw new UnsupportedMediaTypeException({
        code: 'COVER_TYPE_UNSUPPORTED',
        message: 'Only JPEG, PNG, or WebP images are accepted.',
      });
    }

    const objectKey = `card-covers/${cardId}/${randomUUID()}.${ext}`;
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
   *  request that's replacing or removing the card's cover over it. */
  async deleteByUrl(url: string): Promise<void> {
    const bucketName = this.config.gcs.cardCoversBucket;
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
