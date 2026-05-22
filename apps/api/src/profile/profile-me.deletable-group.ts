import { BadRequestException } from "@nestjs/common";
import { FieldCategory } from "@prisma/client";
import { ProfileDeletableGroupCategory } from "./dto/profile-deletable-group-category.enum";

export function fieldCategoryFromDeletable(
  category: ProfileDeletableGroupCategory,
): FieldCategory {
  switch (category) {
    case ProfileDeletableGroupCategory.WORK:
      return FieldCategory.WORK;
    case ProfileDeletableGroupCategory.BUSINESS:
      return FieldCategory.BUSINESS;
    case ProfileDeletableGroupCategory.SOCIAL:
      return FieldCategory.SOCIAL;
    case ProfileDeletableGroupCategory.FINANCIAL:
      return FieldCategory.FINANCIAL;
    default:
      throw new BadRequestException("Invalid group category");
  }
}
