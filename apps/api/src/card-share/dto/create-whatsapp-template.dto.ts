import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { WhatsappTemplateUseCase } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateWhatsappTemplateDto {
  @ApiProperty({
    description:
      "Unique template key (snake_case). Used to reference the template in share requests.",
    example: "card_share_default_en",
  })
  @IsString()
  @Matches(/^[a-z0-9_]+$/, {
    message: "key must be lowercase letters, digits, and underscores only",
  })
  @MinLength(3)
  @MaxLength(64)
  key!: string;

  @ApiProperty({
    description:
      "Template body text. Use {{1}} sender name, {{2}} card name, {{3}} optional note. " +
      "Body must start and end with literal text (not a variable) per WhatsApp policy.",
    example:
      'New contact card: {{1}} shared "{{2}}" with you on ContactBook.{{3}} Tap the button below to save it to your phone.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(1024)
  body!: string;

  @ApiPropertyOptional({
    description: 'Label on the URL button. Defaults to "Save Contact".',
    example: "Save Contact",
    default: "Save Contact",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(25)
  buttonTitle?: string;

  @ApiPropertyOptional({
    description:
      'WhatsApp template category submitted to Meta for review. Defaults to "UTILITY".',
    enum: ["UTILITY", "MARKETING", "AUTHENTICATION"],
    default: "UTILITY",
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    enum: WhatsappTemplateUseCase,
    default: WhatsappTemplateUseCase.CARD_SHARE,
  })
  @IsOptional()
  @IsEnum(WhatsappTemplateUseCase)
  useCase?: WhatsappTemplateUseCase;

  @ApiPropertyOptional({ default: "en" })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @ApiPropertyOptional({
    description:
      "Set as the default template for this use case + locale. Clears isDefault on any existing default.",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
