import { ApiPropertyOptional } from '@nestjs/swagger';
import { TemplateStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// key, purpose, and contentSid are not editable here — a template rotating
// wording gets a NEW key (e.g. "_v2") and its own Twilio approval, rather
// than mutating an already-approved one out from under any code that cached
// its approvalStatus.
export class UpdateWhatsAppTemplateDto {
  @ApiPropertyOptional({
    enum: TemplateStatus,
    example: TemplateStatus.APPROVED,
    description:
      'Set after checking Twilio Console — nothing here verifies against Twilio yet.',
  })
  @IsOptional()
  @IsEnum(TemplateStatus)
  approvalStatus?: TemplateStatus;

  @ApiPropertyOptional({
    example: 'Body text exceeded WhatsApp’s 1024-char limit',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Flip off to stop this template from being picked for new sends without deleting the registry row.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
