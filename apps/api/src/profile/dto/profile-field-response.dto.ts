import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { FieldType } from "@prisma/client";

export class ProfileFieldResponseDto {
  @ApiProperty({ description: "Profile field UUID — use as fieldId when mapping fields onto a card." })
  id!: string;

  @ApiProperty({ description: "Field type (e.g. PHONE, EMAIL, COMPANY)." })
  type!: FieldType;

  @ApiPropertyOptional({ description: "User-assigned label, if any." })
  label!: string | null;

  @ApiPropertyOptional({ description: "Field value. Null for sensitive fields." })
  value!: string | null;

  @ApiProperty({ description: "The FieldGroup this field belongs to." })
  groupId!: string;
}
