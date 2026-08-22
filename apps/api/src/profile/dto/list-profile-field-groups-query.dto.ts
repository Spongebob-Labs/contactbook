import { ApiPropertyOptional } from '@nestjs/swagger';
import { FieldGroupCategory } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListProfileFieldGroupsQueryDto {
  @ApiPropertyOptional({ enum: FieldGroupCategory })
  @IsOptional()
  @IsEnum(FieldGroupCategory)
  category?: FieldGroupCategory;

  @ApiPropertyOptional({
    default: false,
    description: 'Include archived groups and their fields.',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean;
}
