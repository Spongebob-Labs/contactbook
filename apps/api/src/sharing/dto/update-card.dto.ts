import { ApiPropertyOptional } from '@nestjs/swagger';
import { CardKind } from '@prisma/client';
import {
  Equals,
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

  // --- Appearance — omitted means "leave whatever's already stored alone";
  // explicit `null` (where the field below is typed to allow it) clears it.
  // That distinction is load-bearing for the frontend, so it's honored
  // precisely: cards.service.ts's update() spreads a field into the Prisma
  // `data` object whenever it's `!== undefined`, which is exactly "present
  // in the request, whether null or a real value." `@IsOptional()` treats
  // both null and undefined as "skip further validation," so a field typed
  // `T | null` below validates correctly either way. ---

  @ApiPropertyOptional({
    enum: CARD_TEMPLATE_IDS,
    example: 'meridian',
    description: 'Not nullable — every card always has a template.',
  })
  @IsOptional()
  @IsIn(CARD_TEMPLATE_IDS)
  templateId?: string;

  @ApiPropertyOptional({
    enum: CARD_PALETTE_IDS,
    example: 'sapphire',
    nullable: true,
    description: 'null clears it (falls back to the template default).',
  })
  @IsOptional()
  @IsIn(CARD_PALETTE_IDS)
  paletteId?: string | null;

  @ApiPropertyOptional({
    example: '#1B4F72',
    nullable: true,
    description:
      'Free colour, #RRGGBB. Overrides paletteId when set. null clears it.',
  })
  @IsOptional()
  @Matches(GROUND_HEX_PATTERN, {
    message: 'groundHex must be a #RRGGBB hex colour',
  })
  groundHex?: string | null;

  @ApiPropertyOptional({
    enum: CARD_FINISH_IDS,
    example: 'gradient',
    nullable: true,
    description: 'null clears it (falls back to the "gradient" default).',
  })
  @IsOptional()
  @IsIn(CARD_FINISH_IDS)
  finish?: string | null;

  @ApiPropertyOptional({
    enum: CARD_TEXTURE_IDS,
    example: 'none',
    nullable: true,
    description: 'null clears it (falls back to the "none" default).',
  })
  @IsOptional()
  @IsIn(CARD_TEXTURE_IDS)
  texture?: string | null;

  @ApiPropertyOptional({
    enum: CARD_TEXTURE_PRESENCE_IDS,
    example: 'subtle',
    nullable: true,
  })
  @IsOptional()
  @IsIn(CARD_TEXTURE_PRESENCE_IDS)
  texturePresence?: string | null;

  @ApiPropertyOptional({
    enum: CARD_TEXTURE_SCALE_IDS,
    example: 'fine',
    nullable: true,
  })
  @IsOptional()
  @IsIn(CARD_TEXTURE_SCALE_IDS)
  textureScale?: string | null;

  @ApiPropertyOptional({
    example: 'Head of Partnerships',
    maxLength: 80,
    nullable: true,
    description:
      'Printed under the name — overrides the profile job title on this card. null clears it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  headline?: string | null;

  @ApiPropertyOptional({
    example: 'Connecting people, ideas and opportunities.',
    maxLength: 280,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string | null;

  @ApiPropertyOptional({
    // Explicit type hint, deliberately: a property typed purely `null` in
    // TS reflects ambiguously through reflect-metadata and makes
    // @nestjs/swagger throw "A circular dependency has been detected" at
    // boot — verified live. Declaring it as a nullable string sidesteps
    // that; @Equals(null) below is still what actually enforces "only null
    // is accepted" at runtime, this is Swagger-description-only.
    type: String,
    nullable: true,
    description:
      'The ONLY accepted value is literal null, to remove the cover — same ' +
      'effect as DELETE /cards/:id/cover. A real cover can only ever be set ' +
      'by uploading one via POST /cards/:id/cover, never as a string here.',
  })
  @IsOptional()
  @Equals(null, {
    message:
      'coverUrl can only be explicitly set to null (to remove it) — upload a new cover via POST /cards/:id/cover',
  })
  coverUrl?: null;
}
