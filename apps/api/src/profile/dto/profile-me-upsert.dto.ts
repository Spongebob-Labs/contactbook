import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { AddressPayloadDto } from "./address-payload.dto";
import { BankAccountPayloadDto } from "./bank-account-payload.dto";
import { CryptoWalletPayloadDto } from "./crypto-wallet-payload.dto";
import { DigitalWalletPayloadDto } from "./digital-wallet-payload.dto";

export class ProfileMeIdentityUpsertDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  primaryPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  primaryEmail?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  profilePhoto?: string | null;
}

export class ProfileMePersonalUpsertDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  tag?: string;

  @ApiPropertyOptional({ type: () => AddressPayloadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressPayloadDto)
  postalAddress?: AddressPayloadDto;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "string" },
  })
  @IsOptional()
  @IsObject()
  custom?: Record<string, string>;
}

export class ProfileMeGroupItemUpsertDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  tag?: string;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "string" },
  })
  @IsOptional()
  @IsObject()
  custom?: Record<string, string>;
}

export class ProfileMeBankRowUpsertDto extends BankAccountPayloadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fieldId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  tag?: string;
}

export class ProfileMeWalletRowUpsertDto extends DigitalWalletPayloadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fieldId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  tag?: string;
}

export class ProfileMeCryptoRowUpsertDto extends CryptoWalletPayloadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fieldId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  tag?: string;
}

export class ProfileMeFinancialUpsertDto {
  @ApiPropertyOptional({ type: [ProfileMeBankRowUpsertDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileMeBankRowUpsertDto)
  bankAccounts?: ProfileMeBankRowUpsertDto[];

  @ApiPropertyOptional({ type: [ProfileMeWalletRowUpsertDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileMeWalletRowUpsertDto)
  digitalWallets?: ProfileMeWalletRowUpsertDto[];

  @ApiPropertyOptional({ type: [ProfileMeCryptoRowUpsertDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileMeCryptoRowUpsertDto)
  cryptoWallets?: ProfileMeCryptoRowUpsertDto[];
}

/** PATCH / PUT body — only include sections to change (PATCH) or full profile (PUT). */
export class ProfileMePatchDto {
  @ApiPropertyOptional({ type: () => ProfileMeIdentityUpsertDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileMeIdentityUpsertDto)
  identity?: ProfileMeIdentityUpsertDto;

  @ApiPropertyOptional({ type: () => ProfileMePersonalUpsertDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileMePersonalUpsertDto)
  personal?: ProfileMePersonalUpsertDto & Record<string, unknown>;

  @ApiPropertyOptional({ type: [ProfileMeGroupItemUpsertDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileMeGroupItemUpsertDto)
  work?: (ProfileMeGroupItemUpsertDto & Record<string, unknown>)[];

  @ApiPropertyOptional({ type: [ProfileMeGroupItemUpsertDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileMeGroupItemUpsertDto)
  business?: (ProfileMeGroupItemUpsertDto & Record<string, unknown>)[];

  @ApiPropertyOptional({ type: [ProfileMeGroupItemUpsertDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileMeGroupItemUpsertDto)
  socials?: (ProfileMeGroupItemUpsertDto & Record<string, unknown>)[];

  @ApiPropertyOptional({ type: () => ProfileMeFinancialUpsertDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileMeFinancialUpsertDto)
  financial?: ProfileMeFinancialUpsertDto;
}

export class ProfileMePutDto extends ProfileMePatchDto {}
