import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsString } from "class-validator";
import { SHARE_TEMPLATE_VARIANTS } from "../share-template-variants";

const VARIANT_IDS = SHARE_TEMPLATE_VARIANTS.map((v) => v.id);

/**
 * multipart/form-data payload for user-created share templates. Users pick a body
 * variant (no freeform text — keeps Meta approval predictable) and may attach a
 * header image under the `image` field.
 */
export class CreateShareTemplateDto {
  @ApiProperty({
    description:
      "Body copy variant. List options via GET /cards/share-templates/variants.",
    enum: VARIANT_IDS,
    example: "classic",
  })
  @IsString()
  @IsIn(VARIANT_IDS)
  variant!: string;

  @ApiPropertyOptional({
    type: "string",
    format: "binary",
    description:
      "Optional header image (jpeg/png/webp, max 5 MB) shown above the message body.",
  })
  image?: unknown;
}
