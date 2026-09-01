import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class OnboardingBankAccountDto {
  @ApiPropertyOptional({ example: 'Primary salary account', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tag?: string;

  @ApiPropertyOptional({ example: 'HDFC Bank', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @ApiPropertyOptional({ example: 'Ada Lovelace', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  accountHolder?: string;

  @ApiPropertyOptional({
    example: '1234567890123456',
    description:
      'Encrypted at rest automatically — see field-encryption.util.ts.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'HDFC0001234', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ifsc?: string;

  @ApiPropertyOptional({ example: 'USD', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;
}

export class OnboardingDigitalWalletDto {
  @ApiPropertyOptional({ example: 'Primary UPI', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tag?: string;

  @ApiPropertyOptional({ example: 'PayPal', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  platform?: string;

  @ApiPropertyOptional({
    example: 'ada@upi',
    description: 'Encrypted at rest automatically.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  handleOrLink?: string;
}

export class OnboardingCryptoWalletDto {
  @ApiPropertyOptional({ example: 'Cold storage', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tag?: string;

  @ApiPropertyOptional({ example: 'Bitcoin', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  network?: string;

  @ApiPropertyOptional({
    example: 'bc1q...',
    description: 'Encrypted at rest automatically.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
}

export class OnboardingFinancialDto {
  @ApiPropertyOptional({ type: [OnboardingBankAccountDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingBankAccountDto)
  bankAccounts?: OnboardingBankAccountDto[];

  @ApiPropertyOptional({ type: [OnboardingDigitalWalletDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingDigitalWalletDto)
  digitalWallets?: OnboardingDigitalWalletDto[];

  @ApiPropertyOptional({ type: [OnboardingCryptoWalletDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingCryptoWalletDto)
  cryptoWallets?: OnboardingCryptoWalletDto[];
}
