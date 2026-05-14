import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PostalAddressMeDto {
  @ApiProperty()
  street!: string;

  @ApiProperty()
  city!: string;

  @ApiPropertyOptional({ nullable: true })
  state!: string | null;

  @ApiPropertyOptional({ nullable: true })
  pincode!: string | null;

  @ApiProperty()
  country!: string;
}

export class ProfileMeIdentityDto {
  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ description: "E.164 primary phone from auth profile." })
  primaryPhone!: string;

  @ApiProperty()
  primaryEmail!: string;

  @ApiPropertyOptional({ nullable: true, description: "From IDENTITY PHOTO/URL fields." })
  profilePhoto?: string | null;
}

/** Personal block: always includes `groupId` and `tag` plus merged profile fields. */
export class ProfileMePersonalDto {
  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  tag!: string;

  @ApiPropertyOptional({ type: () => PostalAddressMeDto })
  postalAddress?: PostalAddressMeDto;

  @ApiPropertyOptional({ type: "object", additionalProperties: { type: "string" } })
  custom?: Record<string, string>;
}

export class ProfileMeWorkItemDto {
  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  tag!: string;

  @ApiPropertyOptional()
  companyName?: string | null;

  @ApiPropertyOptional()
  companyLogo?: string | null;

  @ApiPropertyOptional()
  workTitle?: string | null;

  @ApiPropertyOptional({ type: () => PostalAddressMeDto })
  workPostalAddress?: PostalAddressMeDto;

  @ApiPropertyOptional({ type: "object", additionalProperties: { type: "string" } })
  custom?: Record<string, string>;
}

export class ProfileMeBusinessItemDto {
  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  tag!: string;

  @ApiPropertyOptional()
  businessName?: string | null;

  @ApiPropertyOptional()
  businessLogo?: string | null;

  @ApiPropertyOptional()
  businessTitle?: string | null;

  @ApiPropertyOptional({ type: () => PostalAddressMeDto })
  businessPostalAddress?: PostalAddressMeDto;

  @ApiPropertyOptional({ type: "object", additionalProperties: { type: "string" } })
  custom?: Record<string, string>;
}

export class ProfileMeSocialItemDto {
  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  tag!: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: { type: "string" } })
  custom?: Record<string, string>;
}

export class ProfileMeBankRowDto {
  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  tag!: string;

  @ApiProperty()
  bankName!: string;

  @ApiProperty()
  accountHolder!: string;

  @ApiProperty()
  accountNumber!: string;

  @ApiPropertyOptional({ nullable: true })
  ifsc?: string | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  isSensitive!: boolean;
}

export class ProfileMeDigitalWalletRowDto {
  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  tag!: string;

  @ApiProperty()
  platform!: string;

  @ApiProperty()
  handleOrLink!: string;

  @ApiProperty()
  isSensitive!: boolean;
}

export class ProfileMeCryptoWalletRowDto {
  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  tag!: string;

  @ApiProperty()
  network!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty()
  isSensitive!: boolean;
}

export class ProfileMeFinancialDto {
  @ApiProperty({ type: [ProfileMeBankRowDto] })
  bankAccounts!: ProfileMeBankRowDto[];

  @ApiProperty({ type: [ProfileMeDigitalWalletRowDto] })
  digitalWallets!: ProfileMeDigitalWalletRowDto[];

  @ApiProperty({ type: [ProfileMeCryptoWalletRowDto] })
  cryptoWallets!: ProfileMeCryptoWalletRowDto[];
}

export class ProfileMeResponseDto {
  @ApiProperty({ type: () => ProfileMeIdentityDto })
  identity!: ProfileMeIdentityDto;

  @ApiProperty({ type: () => ProfileMePersonalDto })
  personal!: ProfileMePersonalDto;

  @ApiProperty({ type: [ProfileMeWorkItemDto] })
  work!: ProfileMeWorkItemDto[];

  @ApiProperty({ type: [ProfileMeBusinessItemDto] })
  business!: ProfileMeBusinessItemDto[];

  @ApiProperty({ type: [ProfileMeSocialItemDto] })
  socials!: ProfileMeSocialItemDto[];

  @ApiProperty({ type: () => ProfileMeFinancialDto })
  financial!: ProfileMeFinancialDto;
}
