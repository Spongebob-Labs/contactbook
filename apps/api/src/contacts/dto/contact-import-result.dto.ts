import { ApiProperty } from "@nestjs/swagger";
import { ContactImportSkippedItemDto } from "./contact-import-skipped-item.dto";

export class ContactImportResultDto {
  @ApiProperty({ type: String, format: "date-time" })
  completedAt!: Date;

  @ApiProperty({ description: "New contact rows created in this import run." })
  created!: number;

  @ApiProperty({
    description:
      "Existing active rows updated or linked via dedup to an existing merge group.",
  })
  updated!: number;

  @ApiProperty({
    type: [ContactImportSkippedItemDto],
    description:
      "Records from the payload that were not stored. Use skipped.length for the count.",
  })
  skipped!: ContactImportSkippedItemDto[];
}
