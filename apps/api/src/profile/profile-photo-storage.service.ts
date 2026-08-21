import {
  Injectable,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Storage } from '@google-cloud/storage';
import { AppConfigService } from '../config/app-config.service';
import { ApiError } from '../common/errors/api-error';

export const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20 MiB

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Uploads to a bucket with uniform bucket-level access and `allUsers` granted
 * `objectViewer` — every object is public-read by design, since a profile
 * photo has to render on a public share page eventually. No signed URLs, no
 * per-object ACL calls; the bucket-level policy already covers it.
 *
 * Uses Application Default Credentials — no key file. On the VM this is the
 * attached service account; locally it's whatever `gcloud auth
 * application-default login` set up.
 */
@Injectable()
export class ProfilePhotoStorageService {
  private readonly storage = new Storage();

  constructor(private readonly config: AppConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.gcs.profilePhotosBucket);
  }

  /** Validates from the actual file bytes' declared mimetype (multer/Express
   *  sets this from the upload's Content-Type, not from the filename) and
   *  from size, then uploads and returns the public URL. Does not touch the
   *  database — the caller owns writing the resulting URL into a ProfileField. */
  async upload(
    userId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<string> {
    const bucketName = this.config.gcs.profilePhotosBucket;
    if (!bucketName) {
      throw ApiError.conflict(
        'PHOTO_STORAGE_NOT_CONFIGURED',
        'Profile photo storage is not configured.',
      );
    }

    if (file.size > MAX_PHOTO_BYTES) {
      throw new PayloadTooLargeException({
        code: 'PHOTO_TOO_LARGE',
        message: `Photo exceeds the ${MAX_PHOTO_BYTES / (1024 * 1024)} MB limit.`,
      });
    }

    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw new UnsupportedMediaTypeException({
        code: 'PHOTO_TYPE_UNSUPPORTED',
        message: 'Only JPEG, PNG, or WebP images are accepted.',
      });
    }

    // Unguessable, user-id-prefixed — not a security boundary (the bucket is
    // public-read regardless) but keeps one user's uploads from colliding
    // with or overwriting another's.
    const objectKey = `${userId}/${randomUUID()}.${ext}`;
    const bucket = this.storage.bucket(bucketName);

    await bucket.file(objectKey).save(file.buffer, {
      contentType: file.mimetype,
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      resumable: false,
    });

    return `${this.config.gcs.publicBaseUrl}/${objectKey}`;
  }

  /** Best-effort. A failed delete leaves an orphaned object in the bucket —
   *  acceptable (it's cheap, unlisted storage), not acceptable to fail the
   *  request that's replacing or removing the user's photo over it. */
  async deleteByUrl(url: string): Promise<void> {
    const bucketName = this.config.gcs.profilePhotosBucket;
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
