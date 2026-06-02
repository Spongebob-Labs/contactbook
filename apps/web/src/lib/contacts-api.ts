import { apiFetch } from "@/lib/api";
import type {
  ContactDetail,
  ContactGroup,
  ContactImportSummary,
  ContactLabel,
  ContactSource,
} from "@/lib/types";

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

export async function fetchContactTags(): Promise<ContactLabel[]> {
  return apiFetch<ContactLabel[]>("/v1/contacts/tags");
}

export async function fetchContactGroups(): Promise<ContactGroup[]> {
  return apiFetch<ContactGroup[]>("/v1/contacts/groups");
}

export async function fetchContactSourceTotals(
  sources: ContactSource[],
): Promise<Record<ContactSource, number>> {
  const entries = await Promise.all(
    sources.map(async (source) => {
      const params = new URLSearchParams({
        source,
        limit: "1",
      });
      try {
        const response = await apiFetch<ContactListResponse>(
          `/v1/contacts?${params.toString()}`,
        );
        return [source, response.total] as const;
      } catch {
        return [source, 0] as const;
      }
    }),
  );

  return Object.fromEntries(entries) as Record<ContactSource, number>;
}

export async function setContactTags(
  contactId: string,
  tagIds: string[],
): Promise<ContactDetail> {
  return apiFetch<ContactDetail>(`/v1/contacts/${contactId}/tags`, {
    method: "PUT",
    body: { tagIds },
  });
}

export async function setContactGroups(
  contactId: string,
  groupIds: string[],
): Promise<ContactDetail> {
  return apiFetch<ContactDetail>(`/v1/contacts/${contactId}/groups`, {
    method: "PUT",
    body: { groupIds },
  });
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
