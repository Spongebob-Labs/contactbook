import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SHAREABLE_FIELD_TYPES } from "../vcard-generator.service";
import type { FieldType } from "@prisma/client";

export class VcardAssetResponseDto {
  @ApiProperty({
    description: "GCS object key (path suffix used as template variable {{4}})",
    example: "abc123/deadbeef.vcf",
  })
  objectKey!: string;

  @ApiProperty({
    description: "Full public GCS URL to the VCF file",
    example: "https://storage.googleapis.com/contactbook-card-shares/abc123/deadbeef.vcf",
  })
  url!: string;

  @ApiPropertyOptional({
    description: "Field types included in this VCF (omitted means all shareable fields)",
    type: [String],
    enum: SHAREABLE_FIELD_TYPES,
  })
  fieldTypes?: FieldType[];

  @ApiProperty({ description: "VCF file size in bytes", example: 512 })
  sizeBytes!: number;
}
