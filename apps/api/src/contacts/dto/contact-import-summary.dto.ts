import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ContactSource } from "@prisma/client";

export class ContactSourceImportSummaryDto {
  @ApiProperty({ enum: ContactSource })
  source!: ContactSource;

  @ApiProperty({ description: "Active (non-deleted) contacts for this source." })
  activeCount!: number;

  @ApiProperty({ description: "Contacts soft-deleted for this source." })
  deletedCount!: number;

  @ApiPropertyOptional({
    description: "Last successful sync for this source, when tracked.",
  })
  lastSyncAt?: Date | null;

  @ApiPropertyOptional({
    description: "Whether a sync cursor is stored (e.g. Google sync token).",
  })
  hasSyncToken?: boolean;
}

export class ContactImportSummaryDto {
  @ApiProperty({
    description: "Total active contacts across all sources.",
  })
  totalActive!: number;

  @ApiProperty({
    description: "Total soft-deleted contacts across all sources.",
  })
  totalDeleted!: number;

  @ApiProperty({ type: [ContactSourceImportSummaryDto] })
  bySource!: ContactSourceImportSummaryDto[];
}
