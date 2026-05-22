import { ApiProperty } from "@nestjs/swagger";

export class ContactSyncStatsDto {
  @ApiProperty({ description: "New contact rows created in this run." })
  added!: number;

  @ApiProperty({ description: "Existing rows updated in this run." })
  updated!: number;

  @ApiProperty({ description: "Contacts soft-deleted in this run." })
  deleted!: number;

  @ApiProperty({
    description:
      "Cross-provider duplicates linked to an existing merge group via phone/email fingerprint.",
  })
  duplicatesFound!: number;
}
