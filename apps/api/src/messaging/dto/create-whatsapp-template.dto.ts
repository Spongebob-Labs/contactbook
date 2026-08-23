import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessagePurpose, TemplateStatus } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateWhatsAppTemplateDto {
  @ApiProperty({
    example: 'card_share_initial_en',
    maxLength: 80,
    description:
      'Your own semantic name — what the app looks up templates by, not Twilio’s id.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  key!: string;

  @ApiProperty({ enum: MessagePurpose, example: MessagePurpose.CARD_SHARE })
  @IsEnum(MessagePurpose)
  purpose!: MessagePurpose;

  @ApiProperty({
    example: 'HXa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d',
    description:
      'The ContentSid Twilio assigned when this template was created in Content API / Console.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  contentSid!: string;

  @ApiPropertyOptional({ example: 'en', default: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @ApiProperty({
    example:
      'Hi! {{1}} shared their ContactBook card with you. Tap below to view their latest contact details.',
    description:
      'Mirror of the approved body text, for humans reading the registry — not sent to Twilio.',
    maxLength: 1024,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  bodyPreview!: string;

  @ApiPropertyOptional({ example: 'View contact card', maxLength: 25 })
  @IsOptional()
  @IsString()
  @MaxLength(25)
  buttonLabel?: string;

  @ApiProperty({
    example: { '1': 'ownerName', '2': 'shareToken' },
    description:
      'Documents what each numbered Twilio variable means, in the order the template body/button use them. Not validated against Twilio — this is our own record for whoever builds the send call.',
  })
  @IsObject()
  variableSchema!: Record<string, string>;

  @ApiPropertyOptional({
    enum: TemplateStatus,
    default: TemplateStatus.UNKNOWN,
    description:
      'Set this to APPROVED only after confirming in Twilio Console — nothing here checks Twilio for you yet.',
  })
  @IsOptional()
  @IsEnum(TemplateStatus)
  approvalStatus?: TemplateStatus;
}
