import { ApiPropertyOptional } from "@nestjs/swagger";
import { ContactSource } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export enum ContactListSort {
  NAME = "name",
  UPDATED_AT = "updatedAt",
  SOURCE = "source",
}

export enum ContactListSortOrder {
  ASC = "asc",
  DESC = "desc",
}

export class ListContactsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;

  @ApiPropertyOptional({
    description:
      "Case-insensitive match on first name, last name, and nickname. Tag search is not supported yet.",
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ContactSource })
  @IsOptional()
  @IsEnum(ContactSource)
  source?: ContactSource;

  @ApiPropertyOptional({ enum: ContactListSort, default: ContactListSort.NAME })
  @IsOptional()
  @IsEnum(ContactListSort)
  sort: ContactListSort = ContactListSort.NAME;

  @ApiPropertyOptional({
    enum: ContactListSortOrder,
    default: ContactListSortOrder.ASC,
  })
  @IsOptional()
  @IsEnum(ContactListSortOrder)
  sortOrder: ContactListSortOrder = ContactListSortOrder.ASC;
}
