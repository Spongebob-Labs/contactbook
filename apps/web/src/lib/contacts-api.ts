import { apiFetch } from "@/lib/api";
import type {
  ContactDetail,
  ContactGroup,
  ContactImportResult,
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

export type ContactSyncResult = {
  source: "GOOGLE" | "ICLOUD";
  syncMode: string;
  stats: {
    created: number;
    updated: number;
    deleted: number;
    skipped: number;
  };
  processedCount: number;
  totalContacts: number;
  lastSyncAt: string | null;
  recoveredFromExpiredToken?: boolean;
};

export type { ContactImportResult };

export async function fetchContactsPage(
  query: Record<string, string> = {},
): Promise<ContactListResponse> {
  const params = new URLSearchParams(query);
  return apiFetch<ContactListResponse>(`/v1/contacts?${params.toString()}`);
}

export async function fetchAllContacts(
  query: Record<string, string> = {},
): Promise<ContactDetail[]> {
  const items: ContactDetail[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const response = await fetchContactsPage({
      page: String(page),
      limit: "100",
      ...query,
    });
    items.push(...response.items);
    totalPages = response.totalPages;
    page += 1;
  }

  return items;
}

export async function fetchContact(contactId: string): Promise<ContactDetail> {
  return apiFetch<ContactDetail>(`/v1/contacts/${contactId}`);
}

export async function patchContact(
  contactId: string,
  body: { notes?: string | null },
): Promise<ContactDetail> {
  return apiFetch<ContactDetail>(`/v1/contacts/${contactId}`, {
    method: "PATCH",
    body,
  });
}

export async function fetchImportSummary(): Promise<ContactImportSummary> {
  const raw = await apiFetch<unknown>("/v1/contacts/import/summary");
  return normalizeImportSummary(raw);
}

type FlatSourceSummary = {
  total?: number;
  activeCount?: number;
  deletedCount?: number;
  lastSyncAt?: string | null;
  hasSyncToken?: boolean;
};

/**
 * Accepts live `{ totalActive, bySource }` and flat doc shape
 * `{ GOOGLE: { total, lastSyncAt }, ... }` → always return ContactImportSummary.
 */
export function normalizeImportSummary(raw: unknown): ContactImportSummary {
  if (!raw || typeof raw !== "object") {
    return { totalActive: 0, totalDeleted: 0, bySource: [] };
  }

  const record = raw as Record<string, unknown>;

  if (Array.isArray(record.bySource)) {
    const bySource = record.bySource as ContactImportSummary["bySource"];
    return {
      totalActive:
        typeof record.totalActive === "number"
          ? record.totalActive
          : bySource.reduce((sum, row) => sum + (row.activeCount ?? 0), 0),
      totalDeleted:
        typeof record.totalDeleted === "number" ? record.totalDeleted : 0,
      bySource,
    };
  }

  const sources: ContactSource[] = ["GOOGLE", "ICLOUD", "VCARD", "CONTACTBOOK"];
  const bySource: ContactImportSummary["bySource"] = [];

  for (const source of sources) {
    const entry = record[source];
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const flat = entry as FlatSourceSummary;
    const activeCount = flat.activeCount ?? flat.total ?? 0;
    bySource.push({
      source,
      activeCount,
      deletedCount: flat.deletedCount ?? 0,
      lastSyncAt: flat.lastSyncAt ?? null,
      hasSyncToken: flat.hasSyncToken,
      lastSync: {
        at: flat.lastSyncAt ?? null,
        hasSyncToken: flat.hasSyncToken,
      },
    });
  }

  return {
    totalActive: bySource.reduce((sum, row) => sum + row.activeCount, 0),
    totalDeleted: bySource.reduce((sum, row) => sum + row.deletedCount, 0),
    bySource,
  };
}

export async function syncContacts(
  source: "GOOGLE" | "ICLOUD",
): Promise<ContactSyncResult> {
  return apiFetch<ContactSyncResult>(
    `/v1/contacts/sync?source=${encodeURIComponent(source)}`,
  );
}

export async function importGoogleContacts(): Promise<ContactImportResult> {
  return apiFetch<ContactImportResult>("/v1/contacts/import/google");
}

export async function importIcloudContacts(input: {
  appleId: string;
  appSpecificPassword: string;
}): Promise<ContactImportResult> {
  return apiFetch<ContactImportResult>("/v1/contacts/import/icloud", {
    method: "POST",
    body: input,
  });
}

export async function disconnectGoogle(): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/v1/integrations/google/disconnect", {
    method: "DELETE",
  });
}

export async function fetchContactTags(): Promise<ContactLabel[]> {
  return apiFetch<ContactLabel[]>("/v1/contacts/tags");
}

export async function fetchContactGroups(): Promise<ContactGroup[]> {
  return apiFetch<ContactGroup[]>("/v1/contacts/groups");
}

export async function createContactTag(name: string): Promise<ContactLabel> {
  return apiFetch<ContactLabel>("/v1/contacts/tags", {
    method: "POST",
    body: { name },
  });
}

export async function renameContactTag(
  tagId: string,
  name: string,
): Promise<ContactLabel> {
  return apiFetch<ContactLabel>(`/v1/contacts/tags/${tagId}`, {
    method: "PATCH",
    body: { name },
  });
}

export async function deleteContactTag(tagId: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/v1/contacts/tags/${tagId}`, {
    method: "DELETE",
  });
}

export async function createContactGroup(name: string): Promise<ContactGroup> {
  return apiFetch<ContactGroup>("/v1/contacts/groups", {
    method: "POST",
    body: { name },
  });
}

export async function renameContactGroup(
  groupId: string,
  name: string,
): Promise<ContactGroup> {
  return apiFetch<ContactGroup>(`/v1/contacts/groups/${groupId}`, {
    method: "PATCH",
    body: { name },
  });
}

export async function deleteContactGroup(
  groupId: string,
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/v1/contacts/groups/${groupId}`, {
    method: "DELETE",
  });
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

export function icloudSummaryHasConnection(
  summary: ContactImportSummary | null,
): boolean {
  const icloud = summary?.bySource.find((item) => item.source === "ICLOUD");
  if (!icloud) {
    return false;
  }
  return Boolean(
    icloud.lastSync?.hasSyncToken ??
      icloud.hasSyncToken ??
      icloud.lastSync?.at ??
      icloud.lastSyncAt ??
      icloud.activeCount,
  );
}
