import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListInboundMessagesQueryDto {
  @ApiPropertyOptional({
    example: '+919876543210',
    description: 'Only messages from this phone number.',
  })
  @IsOptional()
  @IsString()
  fromPhoneE164?: string;

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
