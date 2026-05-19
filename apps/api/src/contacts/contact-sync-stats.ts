export type ContactSyncStats = {
  added: number;
  updated: number;
  deleted: number;
  duplicatesFound: number;
};

export function emptyContactSyncStats(): ContactSyncStats {
  return { added: 0, updated: 0, deleted: 0, duplicatesFound: 0 };
}

export function incrementSyncStat(
  stats: ContactSyncStats,
  outcome: "added" | "updated" | "deleted",
  duplicateFound = false,
): void {
  stats[outcome] += 1;
  if (duplicateFound) {
    stats.duplicatesFound += 1;
  }
}

export function syncStatsProcessedCount(stats: ContactSyncStats): number {
  return stats.added + stats.updated + stats.deleted;
}
