import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { ProfileFieldValueType } from "@prisma/client";

export class CreateProfileFieldDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  key!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ enum: ProfileFieldValueType })
  @IsOptional()
  @IsEnum(ProfileFieldValueType)
  valueType?: ProfileFieldValueType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
