import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * primaryPhone is deliberately not a field here. It is never an onboarding
 * input — it IS the OTP-verified phoneE164 on the authenticated user, echoed
 * back by GET /profile/me. Accepting it here would let someone submit an
 * unverified number into the one slot the rest of the system trusts as real.
 *
 * profilePhoto is also absent — see POST /profile/photo, a separate
 * multipart upload. Onboarding covers text data only.
 */
export class OnboardingIdentityDto {
  @ApiProperty({ example: 'Ada' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Lovelace' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  @MaxLength(200)
  primaryEmail!: string;
}
