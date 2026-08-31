import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AudienceRecipientDto {
  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  shareLinkId!: string;

  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  contactId!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Priya' })
  contactDisplayName!: string | null;

  @ApiProperty({ example: '+919876543210' })
  contactPhoneE164!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 2,
    description:
      'The card version this recipient was last told about, via share or notify. Null only for a link that predates this feature and has never been notified since.',
  })
  lastNotifiedVersion!: number | null;

  @ApiProperty({
    example: 1,
    description:
      'card.currentVersion minus lastNotifiedVersion — 0 means fully caught up.',
  })
  versionsBehind!: number;

  @ApiProperty({ example: 3 })
  viewCount!: number;

  @ApiPropertyOptional({ nullable: true, example: null })
  lastViewedAt!: Date | null;
}
