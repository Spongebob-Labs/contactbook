import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import type { FieldType } from "@prisma/client";
import { normalizeDialCode } from "../../common/phone.util";
import { SHAREABLE_FIELD_TYPES } from "../vcard-generator.service";

export const MAX_SHARE_CARD_RECIPIENTS = 50;

export class ShareCardRecipientDto {
  @ApiProperty({
    description: "Recipient national phone (digits only).",
    example: "4155551234",
  })
  @IsString()
  @Matches(/^\d{4,15}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? value.replace(/\D/g, "") : (value as unknown),
  )
  phone!: string;

  @ApiProperty({
    description: "Recipient E.164 country calling code.",
    example: "+1",
  })
  @IsString()
  @Matches(/^\+\d{1,4}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? normalizeDialCode(value) : (value as unknown),
  )
  countryCode!: string;

  @ApiPropertyOptional({
    description:
      "Existing Contact this recipient corresponds to, if picked from the user's synced contacts (must belong to the requesting user).",
  })
  @IsOptional()
  @IsUUID()
  contactId?: string;
}

export class ShareCardDto {
  @ApiProperty({
    description:
      "The WhatsApp template the sender picked (WhatsappTemplate.key). Required — the " +
      "picked template is exactly what gets sent; there is no default fallback.",
  })
  @IsString()
  @MinLength(1)
  templateKey!: string;

  @ApiPropertyOptional({
    description:
      "Optional personal note injected into the template's personalization variable, if it has one.",
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @ApiPropertyOptional({
    description:
      "Field types to include in the shared VCF. Omit to share all shareable fields. " +
      "Allows the sender to choose e.g. phone-only or phone+email.",
    type: [String],
    enum: SHAREABLE_FIELD_TYPES,
    example: ["PHONE", "EMAIL"],
  })
  @IsOptional()
  @IsArray()
  @IsIn(SHAREABLE_FIELD_TYPES, { each: true })
  fieldTypes?: FieldType[];

  @ApiProperty({
    type: () => [ShareCardRecipientDto],
    description: `1-${MAX_SHARE_CARD_RECIPIENTS} recipients to share the card with.`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SHARE_CARD_RECIPIENTS)
  @ValidateNested({ each: true })
  @Type(() => ShareCardRecipientDto)
  recipients!: ShareCardRecipientDto[];
}
