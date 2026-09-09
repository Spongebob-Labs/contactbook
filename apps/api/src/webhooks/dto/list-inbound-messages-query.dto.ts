import { ApiPropertyOptional } from '@nestjs/swagger';
import { InboundMessageSource } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListInboundMessagesQueryDto {
  @ApiPropertyOptional({
    example: '+919876543210',
    description: 'Only rows from this phone number.',
  })
  @IsOptional()
  @IsString()
  fromPhoneE164?: string;

  @ApiPropertyOptional({
    enum: InboundMessageSource,
    description:
      'Only rows of this kind — a real message, or a QR-scan connect.',
  })
  @IsOptional()
  @IsEnum(InboundMessageSource)
  source?: InboundMessageSource;

  @ApiPropertyOptional({
    default: 100,
    description: 'Max rows to return, newest first.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
