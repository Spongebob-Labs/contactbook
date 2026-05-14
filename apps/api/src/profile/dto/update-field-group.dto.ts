import { ApiPropertyOptional } from "@nestjs/swagger";
import { FieldCategory } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateFieldGroupDto {
  @ApiPropertyOptional({ enum: FieldCategory })
  @IsOptional()
  @IsEnum(FieldCategory)
  category?: FieldCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;
}
