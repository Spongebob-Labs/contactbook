import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { ProfileMePatchDto } from "./profile-me-upsert.dto";

export class ProfileMeOnboardingIdentityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  lastName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  primaryPhone!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(320)
  primaryEmail!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  profilePhoto?: string | null;
}

/**
 * First-time profile setup after registration (`POST /v1/profile/onboarding`).
 * Same nested shape as GET/PATCH `/profile/me`.
 *
 * - `identity` is required (core fields must match registration; only `profilePhoto` is optional).
 * - All other sections are optional; empty shells are ignored.
 * - One-time only — returns 409 if onboarding was already completed.
 */
export class ProfileMeOnboardingDto extends ProfileMePatchDto {
  @ApiProperty({ type: () => ProfileMeOnboardingIdentityDto })
  @ValidateNested()
  @Type(() => ProfileMeOnboardingIdentityDto)
  declare identity: ProfileMeOnboardingIdentityDto;
}
