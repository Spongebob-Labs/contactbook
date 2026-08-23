import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { OnboardingIdentityDto } from './onboarding-identity.dto';
import { OnboardingPersonalDto } from './onboarding-personal.dto';
import { OnboardingWorkEntryDto } from './onboarding-work-entry.dto';
import { OnboardingBusinessEntryDto } from './onboarding-business-entry.dto';
import { OnboardingSocialEntryDto } from './onboarding-social-entry.dto';
import { OnboardingFinancialDto } from './onboarding-financial.dto';

/**
 * Everything except `identity` is optional — a user can complete onboarding
 * with just their name and email and add jobs/wallets/socials later through
 * the granular group and field endpoints. `identity` is the one required
 * section because it updates the User record directly, not a ProfileField —
 * there is no "add your name later" path once onboarding is marked complete.
 */
export class CompleteOnboardingDto {
  @ApiProperty({ type: OnboardingIdentityDto })
  @ValidateNested()
  @Type(() => OnboardingIdentityDto)
  identity!: OnboardingIdentityDto;

  @ApiPropertyOptional({ type: OnboardingPersonalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingPersonalDto)
  personal?: OnboardingPersonalDto;

  @ApiPropertyOptional({ type: [OnboardingWorkEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingWorkEntryDto)
  work?: OnboardingWorkEntryDto[];

  @ApiPropertyOptional({ type: [OnboardingBusinessEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingBusinessEntryDto)
  business?: OnboardingBusinessEntryDto[];

  @ApiPropertyOptional({ type: [OnboardingSocialEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingSocialEntryDto)
  socials?: OnboardingSocialEntryDto[];

  @ApiPropertyOptional({ type: OnboardingFinancialDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingFinancialDto)
  financial?: OnboardingFinancialDto;
}
