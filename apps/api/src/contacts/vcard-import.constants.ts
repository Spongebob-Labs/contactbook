/** Maximum VCF upload size (50 MB). */
export const MAX_VCF_IMPORT_BYTES = 50 * 1024 * 1024;

export const VCF_ALLOWED_EXTENSIONS = [".vcf", ".vcard"] as const;

/** Contacts processed per DB transaction during VCF import. */
export const VCF_IMPORT_BATCH_SIZE = 100;

/** Batch import transaction timeout (ms). */
export const CONTACT_BATCH_TRANSACTION_TIMEOUT_MS = 120_000;

export const VCF_ALLOWED_MIME_TYPES = [
  "text/vcard",
  "text/x-vcard",
  "text/directory",
  "application/vcard",
  "application/octet-stream",
] as const;
