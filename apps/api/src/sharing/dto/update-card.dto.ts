import { ApiPropertyOptional } from '@nestjs/swagger';
import { CardKind } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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
}
