import { apiFetch } from "@/lib/api";
import type { ContactImportResult } from "@/lib/types";

export const VCF_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export function validateVcfFile(file: File): string | null {
  const normalizedName = file.name.toLowerCase();
  const hasVcfExtension =
    normalizedName.endsWith(".vcf") || normalizedName.endsWith(".vcard");

  if (!hasVcfExtension) {
    return "Choose a .vcf or .vcard file.";
  }

  if (file.size > VCF_MAX_FILE_SIZE_BYTES) {
    return "Choose a VCF file under 50 MB.";
  }

  if (file.size === 0) {
    return "Choose a VCF file that is not empty.";
  }

  return null;
}

export async function uploadVcfContacts(
  file: File,
): Promise<ContactImportResult> {
  const body = new FormData();
  body.append("file", file);

  return apiFetch<ContactImportResult>("/v1/contacts/import/vcf", {
    method: "POST",
    body,
  });
}

export function getContactImportCount(result: ContactImportResult): number | null {
  const directCount =
    result.importedCount ??
    result.processedCount ??
    result.createdCount ??
    result.totalContacts ??
    result.summary?.totalActive ??
    result.totalActive;

  return typeof directCount === "number" ? directCount : null;
}
