import { ApiProperty } from '@nestjs/swagger';
import { ProfileFieldResponseDto } from './profile-field-response.dto';
import { ProfileFieldGroupResponseDto } from './profile-field-group-response.dto';

export class MeIdentityDto {
  @ApiProperty({ nullable: true, example: 'Ada' })
  firstName!: string | null;

  @ApiProperty({ nullable: true, example: 'Lovelace' })
  lastName!: string | null;

  @ApiProperty({
    example: '+919347243575',
    description: 'The OTP-verified phone — never independently editable.',
  })
  primaryPhone!: string;

  @ApiProperty({ nullable: true, example: 'ada@example.com' })
  primaryEmail!: string | null;

  @ApiProperty({
    nullable: true,
    example: 'https://storage.googleapis.com/.../photo.jpg',
  })
  profilePhoto!: string | null;
}

export class MeResponseDto {
  @ApiProperty({
    example: false,
    description: 'Whether POST /profile/onboarding has been completed.',
  })
  onboardingCompleted!: boolean;

  @ApiProperty({ type: MeIdentityDto })
  identity!: MeIdentityDto;

  @ApiProperty({
    type: [ProfileFieldResponseDto],
    description: 'Ungrouped PERSONAL-category fields.',
  })
  personal!: ProfileFieldResponseDto[];

  @ApiProperty({ type: [ProfileFieldGroupResponseDto] })
  work!: ProfileFieldGroupResponseDto[];

  @ApiProperty({ type: [ProfileFieldGroupResponseDto] })
  business!: ProfileFieldGroupResponseDto[];

  @ApiProperty({ type: [ProfileFieldGroupResponseDto] })
  socials!: ProfileFieldGroupResponseDto[];

  @ApiProperty({
    type: [ProfileFieldGroupResponseDto],
    description:
      'Bank accounts, digital wallets, and crypto wallets — all category FINANCIAL, distinguished by which FieldTypes their fields use.',
  })
  financial!: ProfileFieldGroupResponseDto[];
}
