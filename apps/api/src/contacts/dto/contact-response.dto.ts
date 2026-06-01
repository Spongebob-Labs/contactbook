import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ContactSource } from "@prisma/client";

export class ContactPhoneDto {
  @ApiProperty()
  value!: string;

  @ApiPropertyOptional()
  label?: string | null;

  @ApiProperty()
  isPrimary!: boolean;
}

export class ContactEmailDto {
  @ApiProperty()
  value!: string;

  @ApiPropertyOptional()
  label?: string | null;

  @ApiProperty()
  isPrimary!: boolean;
}

export class ContactOrganizationDto {
  @ApiPropertyOptional()
  companyName?: string | null;

  @ApiPropertyOptional()
  department?: string | null;

  @ApiPropertyOptional()
  title?: string | null;

  @ApiProperty()
  isPrimary!: boolean;
}

export class ContactAddressDto {
  @ApiPropertyOptional()
  street?: string | null;

  @ApiPropertyOptional()
  city?: string | null;

  @ApiPropertyOptional()
  region?: string | null;

  @ApiPropertyOptional()
  postalCode?: string | null;

  @ApiPropertyOptional()
  country?: string | null;

  @ApiPropertyOptional()
  label?: string | null;

  @ApiProperty()
  isPrimary!: boolean;
}

export class ContactUrlDto {
  @ApiProperty()
  value!: string;

  @ApiPropertyOptional()
  label?: string | null;
}

export class ContactTagDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class ContactGroupDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class ContactProviderLinkDto {
  @ApiProperty({ enum: ContactSource })
  source!: ContactSource;

  @ApiProperty()
  externalId!: string;

  @ApiPropertyOptional()
  sourceRevision?: string | null;

  @ApiProperty({
    description: "True when this link matches the contact row primary source.",
  })
  isPrimary!: boolean;

  @ApiProperty()
  firstLinkedAt!: Date;

  @ApiProperty()
  lastUpdatedAt!: Date;
}

export class ContactSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ContactSource })
  source!: ContactSource;

  @ApiProperty()
  externalId!: string;

  @ApiPropertyOptional({
    description:
      "Cross-provider merge group when phone/email matched another source.",
  })
  mergeGroupId?: string | null;

  @ApiPropertyOptional()
  displayName?: string | null;

  @ApiPropertyOptional()
  firstName?: string | null;

  @ApiPropertyOptional()
  lastName?: string | null;

  @ApiPropertyOptional({ type: ContactPhoneDto })
  primaryPhone?: ContactPhoneDto | null;

  @ApiPropertyOptional({ type: ContactEmailDto })
  primaryEmail?: ContactEmailDto | null;

  @ApiProperty({ type: [ContactTagDto] })
  tags!: ContactTagDto[];

  @ApiProperty({ type: [ContactGroupDto] })
  groups!: ContactGroupDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ContactDetailDto extends ContactSummaryDto {
  @ApiPropertyOptional()
  sourceRevision?: string | null;

  @ApiPropertyOptional()
  middleName?: string | null;

  @ApiPropertyOptional()
  nickname?: string | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty({ type: [ContactPhoneDto] })
  phones!: ContactPhoneDto[];

  @ApiProperty({ type: [ContactEmailDto] })
  emails!: ContactEmailDto[];

  @ApiProperty({ type: [ContactOrganizationDto] })
  organizations!: ContactOrganizationDto[];

  @ApiProperty({ type: [ContactAddressDto] })
  addresses!: ContactAddressDto[];

  @ApiProperty({ type: [ContactUrlDto] })
  urls!: ContactUrlDto[];

  @ApiProperty({
    type: [ContactProviderLinkDto],
    description:
      "All provider keys (source + externalId) that sourced or updated this contact.",
  })
  providerLinks!: ContactProviderLinkDto[];

  @ApiPropertyOptional()
  deletedAt?: Date | null;
}
