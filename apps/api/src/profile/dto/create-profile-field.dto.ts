import { ApiProperty } from '@nestjs/swagger';
import { FieldCategory, FieldType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
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

  @ApiProperty({
    required: false,
    example: 'b7e1c2a3-...',
    description:
      'Attaches this field to one instance of a repeatable thing (a specific job, bank ' +
      'account, etc). Must belong to you — the id of a group belonging to another user is ' +
      'rejected, not silently ignored. Omit for a "loose" field like a personal phone number.',
  })
  @IsOptional()
  @IsUUID()
  groupId?: string;
}
