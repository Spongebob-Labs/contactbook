import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  NotEquals,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { AddressPayloadDto } from "./address-payload.dto";
import { BankAccountPayloadDto } from "./bank-account-payload.dto";
import { CryptoWalletPayloadDto } from "./crypto-wallet-payload.dto";
import { DigitalWalletPayloadDto } from "./digital-wallet-payload.dto";

export class ProfileMeIdentityUpsertDto {
  @ApiPropertyOptional({ nullable: false })
  @IsOptional()
  @NotEquals(null, { message: "identity.firstName cannot be null" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  firstName?: string;

  @ApiPropertyOptional({ nullable: false })
  @IsOptional()
  @NotEquals(null, { message: "identity.lastName cannot be null" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  lastName?: string;

  @ApiPropertyOptional({ nullable: false })
  @IsOptional()
  @NotEquals(null, { message: "identity.primaryPhone cannot be null" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  primaryPhone?: string;

  @ApiPropertyOptional({ nullable: false })
  @IsOptional()
  @NotEquals(null, { message: "identity.primaryEmail cannot be null" })
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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @IsString()
  @MaxLength(200)
  tag?: string | null;

  @ApiPropertyOptional({ type: () => AddressPayloadDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressPayloadDto)
  postalAddress?: AddressPayloadDto | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  mobile?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  landline?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  yearOfBirth?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  currentLocation?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  relationshipStatus?: string | null;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "string", nullable: true },
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  custom?: Record<string, string | null> | null;
}

export class ProfileMeGroupItemUpsertDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @IsString()
  @MaxLength(200)
  tag?: string | null;

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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @IsString()
  @MaxLength(200)
  tag?: string | null;
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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @IsString()
  @MaxLength(200)
  tag?: string | null;
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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @IsString()
  @MaxLength(200)
  tag?: string | null;
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

/** PATCH body — only include sections to change. */
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
