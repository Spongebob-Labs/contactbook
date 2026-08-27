import { ApiPropertyOptional } from '@nestjs/swagger';
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
  CARD_PALETTE_IDS,
  CARD_TEMPLATE_IDS,
  GROUND_HEX_PATTERN,
} from './card-appearance.constants';

export class UpdateCardDto {
  @ApiPropertyOptional({ example: 'Work', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ enum: CardKind })
  @IsOptional()
  @IsEnum(CardKind)
  kind?: CardKind;

  // --- Appearance — omitted means "leave whatever's already stored alone,"
  // same convention as name/kind above (cards.service.ts's
  // conditional-spread pattern). ---

  @ApiPropertyOptional({
    enum: CARD_TEMPLATE_IDS,
    example: 'meridian',
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
    example: 'matte',
    maxLength: 40,
    description: 'Surface finish. FE-owned value set, not yet enumerated here.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  finish?: string;

  @ApiPropertyOptional({
    example: 'none',
    maxLength: 40,
    description:
      'Texture motif, "none" included. FE-owned value set, not yet enumerated here.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  texture?: string;

  @ApiPropertyOptional({
    example: 'subtle',
    maxLength: 40,
    description:
      'How strongly the texture reads. FE-owned value set, not yet enumerated here.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  texturePresence?: string;

  @ApiPropertyOptional({
    example: '1x',
    maxLength: 40,
    description:
      'Multiplier on the texture tile. FE-owned value set, not yet enumerated here.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  textureScale?: string;
}
