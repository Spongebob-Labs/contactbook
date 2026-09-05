import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InboundMessageResponseDto {
  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  id!: string;

  @ApiProperty({ example: 'twilio' })
  provider!: string;

  @ApiProperty({ example: 'SM1234567890abcdef1234567890abcdef' })
  providerMessageId!: string;

  @ApiProperty({
    example: '+919876543210',
    description: 'Whoever messaged us — the "connect" this row represents.',
  })
  fromPhoneE164!: string;

  @ApiProperty({ example: '+15551234567' })
  toPhoneE164!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Hi, is this Ada?' })
  body!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Priya',
    description: "WhatsApp's own display name for the sender, if provided.",
  })
  profileName!: string | null;

  @ApiProperty({ example: '2026-09-05T09:00:00.000Z' })
  receivedAt!: Date;
}
