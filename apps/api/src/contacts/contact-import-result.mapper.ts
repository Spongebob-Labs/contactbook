import type { ContactSyncStats } from "./contact-sync-stats";
import type { ContactImportSkippedItem } from "./contact-import-skipped.types";
import type { ContactImportResultDto } from "./dto/contact-import-result.dto";

export type ContactImportRun = {
  stats: ContactSyncStats;
  skipped: ContactImportSkippedItem[];
  completedAt: Date;
};

export function toContactImportResult(
  run: ContactImportRun,
): ContactImportResultDto {
  return {
    completedAt: run.completedAt,
    created: run.stats.added,
    updated: run.stats.updated,
    skipped: run.skipped,
  };
}
