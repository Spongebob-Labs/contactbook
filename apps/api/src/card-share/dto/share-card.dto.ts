import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { normalizeDialCode } from "../../common/phone.util";

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
  @ApiPropertyOptional({
    description:
      "Which approved WhatsApp template to use (WhatsappTemplate.key). Defaults to the active default CARD_SHARE template if omitted.",
  })
  @IsOptional()
  @IsString()
  templateKey?: string;

  @ApiPropertyOptional({
    description:
      "Optional personal note injected into the template's personalization variable, if it has one.",
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

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
