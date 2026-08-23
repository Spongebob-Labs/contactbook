import { PartialType } from '@nestjs/swagger';
import { CreateProfileFieldGroupDto } from './create-profile-field-group.dto';

// category is intentionally omittable-but-included (not excluded like
// ProfileField.type) — renaming a group from WORK to BUSINESS is a much
// smaller, safer change than reinterpreting a field's data type, since a
// group carries no value of its own to strand.
export class UpdateProfileFieldGroupDto extends PartialType(
  CreateProfileFieldGroupDto,
) {}
