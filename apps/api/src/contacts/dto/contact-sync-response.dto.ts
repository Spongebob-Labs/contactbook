import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ContactSource } from "@prisma/client";
import { ContactSyncStatsDto } from "./contact-sync-stats.dto";

export class ContactSyncResponseDto {
  @ApiProperty({ enum: ContactSource })
  source!: ContactSource;

  @ApiProperty({ enum: ["full", "delta"] })
  syncMode!: "full" | "delta";

  @ApiProperty({ type: ContactSyncStatsDto })
  stats!: ContactSyncStatsDto;

  @ApiProperty({
    description: "Provider records handled (added + updated + deleted).",
  })
  processedCount!: number;

  @ApiProperty({
    description: "Active contacts for this source after sync.",
  })
  totalContacts!: number;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  lastSyncAt?: Date | null;

  @ApiPropertyOptional({
    description:
      "True when sync recovered from an expired Google sync token (410).",
  })
  recoveredFromExpiredToken?: boolean;
}
