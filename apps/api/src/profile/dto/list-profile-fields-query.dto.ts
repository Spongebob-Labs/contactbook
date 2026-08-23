import { ApiPropertyOptional } from '@nestjs/swagger';
import { FieldCategory } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListProfileFieldsQueryDto {
  @ApiPropertyOptional({ enum: FieldCategory })
  @IsOptional()
  @IsEnum(FieldCategory)
  category?: FieldCategory;

  @ApiPropertyOptional({
    default: false,
    description: 'Include archived (soft-deleted) fields.',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean;
}
