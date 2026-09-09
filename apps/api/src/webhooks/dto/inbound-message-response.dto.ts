import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InboundMessageSource } from '@prisma/client';

export class InboundMessageResponseDto {
  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  id!: string;

  @ApiProperty({
    enum: InboundMessageSource,
    example: InboundMessageSource.WHATSAPP_MESSAGE,
    description:
      'WHATSAPP_MESSAGE = a real inbound WhatsApp webhook hit. ' +
      'QR_SCAN_CONNECT = a stranger scanned a card QR and verified their ' +
      'phone via the public "Save & connect" flow. CARD_SHARE = an owner ' +
      'shared a card with a contact. Neither of the latter two involves an ' +
      'actual WhatsApp message Twilio delivered to us.',
  })
  source!: InboundMessageSource;

  @ApiProperty({ example: 'twilio' })
  provider!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'SM1234567890abcdef1234567890abcdef',
    description: 'Twilio MessageSid. Null for QR_SCAN_CONNECT rows.',
  })
  providerMessageId!: string | null;

  @ApiProperty({
    example: '+919876543210',
    description:
      'Whoever initiated contact — the message sender, the QR scanner, or ' +
      'the card owner (for a CARD_SHARE row).',
  })
  fromPhoneE164!: string;

  @ApiProperty({
    example: '+15551234567',
    description:
      'For WHATSAPP_MESSAGE, our fixed WhatsApp business number. For ' +
      'QR_SCAN_CONNECT, the phone number of the card owner who was scanned. ' +
      'For CARD_SHARE, the phone number of the contact the card was shared with.',
  })
  toPhoneE164!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Hi, is this Ada?' })
  body!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Priya',
    description: "WhatsApp's own display name for the sender, if provided.",
  })
  profileName!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '3f1c2b3a-4d5e-4f6a-8b9c-0d1e2f3a4b5c',
    description:
      'The ContactBook User this row resolves to, if any. Always set for ' +
      'QR_SCAN_CONNECT and CARD_SHARE (both know exactly which owner this ' +
      'is about). Always null for WHATSAPP_MESSAGE today — no ' +
      'scan-code-in-message resolution exists yet.',
  })
  resolvedOwnerId!: string | null;

  @ApiProperty({ example: '2026-09-05T09:00:00.000Z' })
  receivedAt!: Date;
}
