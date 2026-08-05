import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional } from "class-validator";
import { SHAREABLE_FIELD_TYPES } from "../vcard-generator.service";
import type { FieldType } from "@prisma/client";

export class GenerateVcardDto {
  @ApiPropertyOptional({
    description:
      "Subset of field types to include in the VCF. Omit to include all shareable fields. " +
      "The resulting asset is content-addressed — the same selection on the same card reuses an existing GCS upload.",
    type: [String],
    enum: SHAREABLE_FIELD_TYPES,
    example: ["PHONE", "EMAIL"],
  })
  @IsOptional()
  @IsArray()
  @IsIn(SHAREABLE_FIELD_TYPES, { each: true })
  fieldTypes?: FieldType[];
}
