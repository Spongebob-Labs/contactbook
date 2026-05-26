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

/** Import-run outcome: active existing or dedup link counts as updated; revive from soft-delete counts as created. */
export function importSyncOutcome(
  hasActiveExisting: boolean,
  duplicateFound: boolean,
): "added" | "updated" {
  if (hasActiveExisting || duplicateFound) {
    return "updated";
  }
  return "added";
}
