import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CardFieldEntryDto {
  @ApiProperty({
    example: 'b7e1c2a3-1234-4f5a-8b6c-7d8e9f0a1b2c',
    description:
      'Must be one of your own ProfileField ids — a field belonging to another user is rejected, not silently skipped.',
  })
  @IsUUID()
  fieldId!: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'Soft-hide without losing this field’s position or label override.',
  })
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @ApiPropertyOptional({
    example: 'Reach me here',
    maxLength: 80,
    description: 'Shown instead of the field’s own label, on this card only.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  labelOverride?: string;
}

export class SetCardFieldsDto {
  @ApiProperty({
    type: [CardFieldEntryDto],
    description:
      'The full curated set, in display order — this REPLACES whatever the card currently has, it does not merge.',
  })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CardFieldEntryDto)
  fields!: CardFieldEntryDto[];
}
