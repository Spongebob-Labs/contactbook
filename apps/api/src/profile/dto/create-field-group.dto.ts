import { ApiProperty } from "@nestjs/swagger";
import { FieldCategory } from "@prisma/client";
import { IsEnum, IsString, MaxLength, MinLength } from "class-validator";

export class CreateFieldGroupDto {
  @ApiProperty({ enum: FieldCategory })
  @IsEnum(FieldCategory)
  category!: FieldCategory;

  @ApiProperty({ example: "SaaS King (Current)" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}
