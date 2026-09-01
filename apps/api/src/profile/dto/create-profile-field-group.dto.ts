import { ApiProperty } from '@nestjs/swagger';
import { FieldGroupCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProfileFieldGroupDto {
  @ApiProperty({ enum: FieldGroupCategory, example: FieldGroupCategory.WORK })
  @IsEnum(FieldGroupCategory)
  category!: FieldGroupCategory;

  @ApiProperty({ required: false, example: 'Acme Corp', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tag?: string;
}
