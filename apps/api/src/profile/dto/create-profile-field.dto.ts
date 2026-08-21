import { ApiProperty } from '@nestjs/swagger';
import { FieldCategory, FieldType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProfileFieldDto {
  @ApiProperty({ enum: FieldCategory, example: FieldCategory.WORK })
  @IsEnum(FieldCategory)
  category!: FieldCategory;

  @ApiProperty({
    enum: FieldType,
    example: FieldType.PHONE,
    description:
      'PHOTO cannot be created here — use POST /profile/photo instead.',
  })
  @IsEnum(FieldType)
  type!: FieldType;

  @ApiProperty({ example: 'Work mobile', maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @ApiProperty({ example: '+14155550142', maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  value!: string;

  @ApiProperty({
    required: false,
    example: 0,
    description: 'Defaults to last position if omitted.',
  })
  @IsOptional()
  @IsInt()
  position?: number;
}
