import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FieldType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { AddressPayloadDto } from "./address-payload.dto";
import { BankAccountPayloadDto } from "./bank-account-payload.dto";
import { CryptoWalletPayloadDto } from "./crypto-wallet-payload.dto";
import { DigitalWalletPayloadDto } from "./digital-wallet-payload.dto";

export class CreateProfileFieldDto {
  @ApiProperty({ enum: FieldType })
  @IsEnum(FieldType)
  type!: FieldType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @ApiPropertyOptional({
    description:
      "Ignored for financial field types (always stored as sensitive).",
  })
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  value?: string;

  @ApiPropertyOptional({ type: () => AddressPayloadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressPayloadDto)
  address?: AddressPayloadDto;

  @ApiPropertyOptional({ type: () => BankAccountPayloadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BankAccountPayloadDto)
  bankAccount?: BankAccountPayloadDto;

  @ApiPropertyOptional({ type: () => DigitalWalletPayloadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DigitalWalletPayloadDto)
  digitalWallet?: DigitalWalletPayloadDto;

  @ApiPropertyOptional({ type: () => CryptoWalletPayloadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CryptoWalletPayloadDto)
  cryptoWallet?: CryptoWalletPayloadDto;
}
