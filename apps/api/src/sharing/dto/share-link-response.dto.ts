import { ApiProperty } from '@nestjs/swagger';
import { ShareLinkStatus } from '@prisma/client';

export class ShareLinkResponseDto {
  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  id!: string;

  @ApiProperty({
    example: 'https://cards.contactbook.app/c/4f8Kq2mR7xJp1sN0vLtQ9a',
    description:
      'What actually goes in the WhatsApp message. Resolves live — never a snapshot.',
  })
  url!: string;

  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  cardId!: string;

  @ApiProperty({ example: 'Work' })
  cardName!: string;

  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  contactId!: string;

  @ApiProperty({ example: '+919876543210' })
  contactPhoneE164!: string;

  @ApiProperty({ nullable: true, example: 'Priya' })
  contactDisplayName!: string | null;

  @ApiProperty({ enum: ShareLinkStatus, example: ShareLinkStatus.ACTIVE })
  status!: ShareLinkStatus;

  @ApiProperty({ example: 3 })
  viewCount!: number;

  @ApiProperty({ nullable: true, example: null })
  firstViewedAt!: Date | null;

  @ApiProperty({ nullable: true, example: null })
  lastViewedAt!: Date | null;

  @ApiProperty({ example: '2026-08-23T18:00:00.000Z' })
  createdAt!: Date;
}
