import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ContactSource } from "@prisma/client";
import {
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class ContactGroupResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ enum: ContactSource })
  source?: ContactSource | null;

  @ApiPropertyOptional()
  externalId?: string | null;
}

export class CreateContactGroupDto {
  @ApiProperty({ example: "Home" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class UpdateContactGroupDto {
  @ApiProperty({ example: "Office" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class SetContactGroupsDto {
  @ApiProperty({
    type: [String],
    description: "Group IDs to assign (replaces existing).",
  })
  @IsArray()
  @IsUUID("4", { each: true })
  groupIds!: string[];
}
