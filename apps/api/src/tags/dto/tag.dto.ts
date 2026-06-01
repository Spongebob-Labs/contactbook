import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class TagResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class CreateTagDto {
  @ApiProperty({ example: "Investor" })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class UpdateTagDto {
  @ApiProperty({ example: "VIP" })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class SetContactTagsDto {
  @ApiProperty({
    type: [String],
    description: "Tag IDs to assign (replaces existing).",
  })
  @IsArray()
  @IsUUID("4", { each: true })
  tagIds!: string[];
}
