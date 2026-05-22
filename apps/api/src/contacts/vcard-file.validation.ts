import { BadRequestException } from "@nestjs/common";
import type { Express } from "express";
import {
  MAX_VCF_IMPORT_BYTES,
  VCF_ALLOWED_EXTENSIONS,
  VCF_ALLOWED_MIME_TYPES,
} from "./vcard-import.constants";

export function assertVcfUploadFile(
  file: Express.Multer.File | undefined,
  options?: { contentType?: string },
): void {
  if (!file) {
    const contentType = options?.contentType ?? "";
    const isMultipart = contentType.includes("multipart/form-data");
    throw new BadRequestException(
      isMultipart
        ? 'Missing required multipart field "file".'
        : 'Expected multipart/form-data with form field "file". Use curl --form \'file=@path.vcf\' (or FormData in the browser); do not send JSON or set Content-Type manually without attaching the file.',
    );
  }
  if (!file.buffer?.length) {
    throw new BadRequestException("VCF file is empty.");
  }
  if (file.size > MAX_VCF_IMPORT_BYTES) {
    throw new BadRequestException(
      `VCF file exceeds the ${MAX_VCF_IMPORT_BYTES / (1024 * 1024)} MB limit.`,
    );
  }

  const name = file.originalname?.toLowerCase() ?? "";
  const extOk = VCF_ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const mime = file.mimetype?.toLowerCase() ?? "";
  const mimeOk =
    mime.length === 0 ||
    (VCF_ALLOWED_MIME_TYPES as readonly string[]).includes(mime);

  if (!extOk && !mimeOk) {
    throw new BadRequestException(
      "Invalid file type. Upload a .vcf or .vcard file.",
    );
  }
}
