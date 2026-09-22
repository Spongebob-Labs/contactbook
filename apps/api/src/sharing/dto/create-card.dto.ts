import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardKind } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CARD_FINISH_IDS,
  CARD_PALETTE_IDS,
  CARD_TEMPLATE_IDS,
  CARD_TEXTURE_IDS,
  CARD_TEXTURE_PRESENCE_IDS,
  CARD_TEXTURE_SCALE_IDS,
  GROUND_HEX_PATTERN,
} from './card-appearance.constants';

export class CreateCardDto {
  @ApiProperty({ example: 'Work', maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ enum: CardKind, default: CardKind.CUSTOM })
  @IsOptional()
  @IsEnum(CardKind)
  kind?: CardKind;

  // --- Appearance — all optional. templateId defaults to "meridian" at the
  // DB level when omitted; the rest stay NULL until the owner picks one. ---

  @ApiPropertyOptional({
    enum: CARD_TEMPLATE_IDS,
    example: 'meridian',
    description: 'Omit to default to "meridian".',
  })
  @IsOptional()
  @IsIn(CARD_TEMPLATE_IDS)
  templateId?: string;

  @ApiPropertyOptional({ enum: CARD_PALETTE_IDS, example: 'sapphire' })
  @IsOptional()
  @IsIn(CARD_PALETTE_IDS)
  paletteId?: string;

  @ApiPropertyOptional({
    example: '#1B4F72',
    description: 'Free colour, #RRGGBB. Overrides paletteId when set.',
  })
  @IsOptional()
  @Matches(GROUND_HEX_PATTERN, {
    message: 'groundHex must be a #RRGGBB hex colour',
  })
  groundHex?: string;

  @ApiPropertyOptional({
    enum: CARD_FINISH_IDS,
    example: 'gradient',
    description: 'Omit to default to "gradient".',
  })
  @IsOptional()
  @IsIn(CARD_FINISH_IDS)
  finish?: string;

  @ApiPropertyOptional({
    enum: CARD_TEXTURE_IDS,
    example: 'none',
    description: 'Omit to default to "none".',
  })
  @IsOptional()
  @IsIn(CARD_TEXTURE_IDS)
  texture?: string;

  @ApiPropertyOptional({ enum: CARD_TEXTURE_PRESENCE_IDS, example: 'subtle' })
  @IsOptional()
  @IsIn(CARD_TEXTURE_PRESENCE_IDS)
  texturePresence?: string;

  @ApiPropertyOptional({ enum: CARD_TEXTURE_SCALE_IDS, example: 'fine' })
  @IsOptional()
  @IsIn(CARD_TEXTURE_SCALE_IDS)
  textureScale?: string;

  @ApiPropertyOptional({
    example: 'Head of Partnerships',
    maxLength: 80,
    description:
      'Printed under the name — overrides the profile job title on this card.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  headline?: string;

  @ApiPropertyOptional({
    example: 'Connecting people, ideas and opportunities.',
    maxLength: 280,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;
}
