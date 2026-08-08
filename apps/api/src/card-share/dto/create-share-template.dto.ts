import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString } from "class-validator";
import { SHARE_TEMPLATE_VARIANTS } from "../share-template-variants";

const VARIANT_IDS = SHARE_TEMPLATE_VARIANTS.map((v) => v.id);

/**
 * multipart/form-data body fields for user-created share templates. The optional
 * header image is a file upload — it is NOT a body field and is handled separately
 * via @UploadedFile() in the controller, so it must not appear here.
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
}
