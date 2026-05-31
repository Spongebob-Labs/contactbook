import { apiFetch } from "@/lib/api";
import type { ContactDetail, ContactImportSummary } from "@/lib/types";

export type ContactListResponse = {
  items: ContactDetail[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export async function fetchAllContacts(
  query: Record<string, string> = {},
): Promise<ContactDetail[]> {
  const items: ContactDetail[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const params = new URLSearchParams({
      page: String(page),
      limit: "100",
      ...query,
    });
    const response = await apiFetch<ContactListResponse>(
      `/v1/contacts?${params.toString()}`,
    );
    items.push(...response.items);
    totalPages = response.totalPages;
    page += 1;
  }

  return items;
}

export async function fetchImportSummary(): Promise<ContactImportSummary> {
  return apiFetch<ContactImportSummary>("/v1/contacts/import/summary");
}

export function contactMatchesSource(
  contact: ContactDetail,
  source: ContactDetail["source"],
): boolean {
  if (contact.source === source) {
    return true;
  }
  return (
    contact.providerLinks?.some((link) => link.source === source) ?? false
  );
}

export function getGoogleLastSyncAt(summary: ContactImportSummary | null) {
  const google = summary?.bySource.find((item) => item.source === "GOOGLE");
  return google?.lastSync?.at ?? google?.lastSyncAt ?? null;
}

export function googleSummaryHasConnection(
  summary: ContactImportSummary | null,
): boolean {
  const google = summary?.bySource.find((item) => item.source === "GOOGLE");
  if (!google) {
    return false;
  }
  return Boolean(
    google.lastSync?.hasSyncToken ??
      google.hasSyncToken ??
      google.lastSync?.at ??
      google.lastSyncAt ??
      google.activeCount,
  );
}
