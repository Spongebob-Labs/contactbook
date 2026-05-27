import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
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
import { IsProfilePhotoUrl } from "../validators/is-profile-photo-url.validator";
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

  @ApiPropertyOptional({
    nullable: true,
    description:
      "HTTPS URL under GCS_PUBLIC_BASE_URL. Set via POST /profile/me/photo; use null to clear.",
  })
  @IsOptional()
  @IsString()
  @IsProfilePhotoUrl()
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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nickname?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  kidsNames?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  partnerName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  petNames?: string | null;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "string", nullable: true },
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  custom?: Record<string, string | null> | null;
}

/** Shared group row keys for work / business / social upserts. */
export class ProfileMeGroupRowBaseUpsertDto {
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
    additionalProperties: { type: "string", nullable: true },
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  custom?: Record<string, string | null> | null;
}

export class ProfileMeWorkUpsertDto extends ProfileMeGroupRowBaseUpsertDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "HTTPS URL under GCS_PUBLIC_BASE_URL. Set via POST /profile/me/photo; use null to clear.",
  })
  @IsOptional()
  @IsString()
  @IsProfilePhotoUrl()
  companyLogo?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyRegNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  workTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  workMobile?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  workLandline?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  workFax?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  workEmail?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  website?: string | null;

  @ApiPropertyOptional({ type: () => AddressPayloadDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressPayloadDto)
  workPostalAddress?: AddressPayloadDto | null;
}

export class ProfileMeBusinessUpsertDto extends ProfileMeGroupRowBaseUpsertDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "HTTPS URL under GCS_PUBLIC_BASE_URL. Set via POST /profile/me/photo; use null to clear.",
  })
  @IsOptional()
  @IsString()
  @IsProfilePhotoUrl()
  businessLogo?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  businessRegNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  businessMobile?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  businessLandline?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  businessFax?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  businessEmail?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  website?: string | null;

  @ApiPropertyOptional({ type: () => AddressPayloadDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressPayloadDto)
  businessPostalAddress?: AddressPayloadDto | null;
}

export class ProfileMeSocialUpsertDto extends ProfileMeGroupRowBaseUpsertDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  skype?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  facebook?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  twitter?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bbmPin?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  whatsApp?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  asw?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bebo?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  blog?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string | null;
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;
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
  personal?: ProfileMePersonalUpsertDto;

  @ApiPropertyOptional({ type: [ProfileMeWorkUpsertDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileMeWorkUpsertDto)
  work?: ProfileMeWorkUpsertDto[];

  @ApiPropertyOptional({ type: [ProfileMeBusinessUpsertDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileMeBusinessUpsertDto)
  business?: ProfileMeBusinessUpsertDto[];

  @ApiPropertyOptional({ type: [ProfileMeSocialUpsertDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileMeSocialUpsertDto)
  socials?: ProfileMeSocialUpsertDto[];

  @ApiPropertyOptional({ type: () => ProfileMeFinancialUpsertDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileMeFinancialUpsertDto)
  financial?: ProfileMeFinancialUpsertDto;
}
