import { ApiProperty, PartialType, PickType } from '@nestjs/swagger';
import { CreateProfileFieldDto } from './create-profile-field.dto';

/**
 * `type` is deliberately excluded and therefore immutable after creation —
 * changing what KIND of data a field holds mid-life (e.g. PHONE -> BANK_ACCOUNT)
 * would strand any existing plaintext value with the wrong encryption
 * treatment. Delete and recreate instead.
 */
export class UpdateProfileFieldDto extends PartialType(
  PickType(CreateProfileFieldDto, [
    'category',
    'label',
    'value',
    'position',
  ] as const),
) {
  @ApiProperty({ required: false, example: 'Personal mobile', maxLength: 80 })
  declare label?: string;
}
