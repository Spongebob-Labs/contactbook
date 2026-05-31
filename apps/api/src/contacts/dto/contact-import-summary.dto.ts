import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ContactSource } from "@prisma/client";
import { ContactSyncStatsDto } from "./contact-sync-stats.dto";

export class ContactLastSyncDto {
  @ApiPropertyOptional({
    description:
      "Timestamp of the most recent successful sync for this source.",
  })
  at?: Date | null;

  @ApiPropertyOptional({
    description: "Whether a sync cursor is stored (e.g. Google sync token).",
  })
  hasSyncToken?: boolean;

  @ApiPropertyOptional({
    type: ContactSyncStatsDto,
    description:
      "Deltas from the most recent sync run only — not current contact inventory.",
  })
  runStats?: ContactSyncStatsDto;
}

export class ContactSourceImportSummaryDto {
  @ApiProperty({ enum: ContactSource })
  source!: ContactSource;

  @ApiProperty({
    description:
      "Active (non-deleted) contacts in the DB where Contact.source equals this value.",
  })
  activeCount!: number;

  @ApiProperty({
    description:
      "Soft-deleted contacts in the DB where Contact.source equals this value.",
  })
  deletedCount!: number;

  @ApiPropertyOptional({
    type: ContactLastSyncDto,
    description: "Optional sync metadata for import-capable sources.",
  })
  lastSync?: ContactLastSyncDto;
}

export class ContactImportSummaryDto {
  @ApiProperty({
    description: "Total active contacts across all sources (live DB count).",
  })
  totalActive!: number;

  @ApiProperty({
    description:
      "Total soft-deleted contacts across all sources (live DB count).",
  })
  totalDeleted!: number;

  @ApiProperty({ type: [ContactSourceImportSummaryDto] })
  bySource!: ContactSourceImportSummaryDto[];
}
