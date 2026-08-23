import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardKind } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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
}
