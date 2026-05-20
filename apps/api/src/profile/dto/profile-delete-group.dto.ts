import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsUUID } from "class-validator";
import { ProfileDeletableGroupCategory } from "./profile-deletable-group-category.enum";

export class ProfileDeleteGroupDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  groupId!: string;

  @ApiProperty({
    enum: ProfileDeletableGroupCategory,
    enumName: "ProfileDeletableGroupCategory",
    example: ProfileDeletableGroupCategory.WORK,
  })
  @IsEnum(ProfileDeletableGroupCategory)
  category!: ProfileDeletableGroupCategory;
}
