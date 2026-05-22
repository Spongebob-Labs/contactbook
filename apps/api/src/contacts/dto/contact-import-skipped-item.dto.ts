import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ContactImportSkipReason } from "../contact-import-skipped.types";

export class ContactImportSkippedItemDto {
  @ApiPropertyOptional({
    description: "Stable id from the import payload (vCard UID, Google resourceName).",
    nullable: true,
  })
  externalId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  displayName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  firstName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  primaryPhone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  primaryEmail!: string | null;

  @ApiProperty({
    enum: Object.values(ContactImportSkipReason),
    description:
      "Why the record was not stored (parse/identity rules). Same bucket as failed-to-import for UI.",
  })
  reason!: ContactImportSkipReason;
}
