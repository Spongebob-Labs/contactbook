import { ApiPropertyOptional } from "@nestjs/swagger";
import { ContactSource } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { parseUuidList } from "../../common/parse-uuid-list";

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
      "Case-insensitive match on first name, last name, and nickname.",
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

  @ApiPropertyOptional({
    description:
      "Comma-separated tag UUIDs. Contact must have all listed tags (AND).",
    type: String,
    example:
      "8cd8e73b-2557-493d-af5a-bdf8186a4345,11111111-1111-4111-8111-111111111111",
  })
  @IsOptional()
  @Transform(({ value }) => parseUuidList(value, "tagIds"))
  @IsArray()
  @IsUUID("4", { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({
    description:
      "Comma-separated group UUIDs. Contact must belong to all listed groups (AND).",
    type: String,
    example:
      "8cd8e73b-2557-493d-af5a-bdf8186a4345,11111111-1111-4111-8111-111111111111",
  })
  @IsOptional()
  @Transform(({ value }) => parseUuidList(value, "groupIds"))
  @IsArray()
  @IsUUID("4", { each: true })
  groupIds?: string[];

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
