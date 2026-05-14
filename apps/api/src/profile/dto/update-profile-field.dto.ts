import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { AddressPayloadDto } from "./address-payload.dto";
import { BankAccountPayloadDto } from "./bank-account-payload.dto";
import { CryptoWalletPayloadDto } from "./crypto-wallet-payload.dto";
import { DigitalWalletPayloadDto } from "./digital-wallet-payload.dto";

export class UpdateProfileFieldDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @ApiPropertyOptional()
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
