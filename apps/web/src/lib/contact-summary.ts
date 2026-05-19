import type { ContactImport, ContactImportSummary } from "@/lib/types";

type SummarizableContact = ContactImport & {
  deletedAt?: string | null;
};

function getLatestDate(current: string | null, next: string | null | undefined) {
  if (!next) {
    return current;
  }
  if (!current) {
    return next;
  }
  return new Date(next).getTime() > new Date(current).getTime() ? next : current;
}

export function buildContactImportSummary(
  contacts: SummarizableContact[],
): ContactImportSummary {
  const bySource = new Map<
    SummarizableContact["source"],
    ContactImportSummary["bySource"][number]
  >();

  for (const contact of contacts) {
    const summary = bySource.get(contact.source) ?? {
      source: contact.source,
      activeCount: 0,
      deletedCount: 0,
      lastSyncAt: null,
    };

    if (contact.deletedAt) {
      summary.deletedCount += 1;
    } else {
      summary.activeCount += 1;
    }
    summary.lastSyncAt = getLatestDate(summary.lastSyncAt ?? null, contact.updatedAt);
    bySource.set(contact.source, summary);
  }

  const sources = Array.from(bySource.values());
  return {
    totalActive: sources.reduce((total, source) => total + source.activeCount, 0),
    totalDeleted: sources.reduce((total, source) => total + source.deletedCount, 0),
    bySource: sources,
  };
}
