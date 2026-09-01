import { ApiProperty } from '@nestjs/swagger';
import { MessagePurpose, TemplateStatus } from '@prisma/client';

export class WhatsAppTemplateResponseDto {
  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  id!: string;

  @ApiProperty({ example: 'card_share_initial_en' })
  key!: string;

  @ApiProperty({ enum: MessagePurpose, example: MessagePurpose.CARD_SHARE })
  purpose!: MessagePurpose;

  @ApiProperty({ example: 'HXa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d' })
  contentSid!: string;

  @ApiProperty({ example: 'en' })
  locale!: string;

  @ApiProperty({
    example:
      'Hi! {{1}} shared their ContactBook card with you. Tap below to view their latest contact details.',
  })
  bodyPreview!: string;

  @ApiProperty({ nullable: true, example: 'View contact card' })
  buttonLabel!: string | null;

  @ApiProperty({ example: { '1': 'ownerName', '2': 'shareToken' } })
  variableSchema!: Record<string, string>;

  @ApiProperty({ enum: TemplateStatus, example: TemplateStatus.UNKNOWN })
  approvalStatus!: TemplateStatus;

  @ApiProperty({ nullable: true, example: null })
  rejectionReason!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-08-23T18:00:00.000Z' })
  createdAt!: Date;
}
