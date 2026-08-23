import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpsertRecipientDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'E.164 format, including the leading +.',
  })
  @IsString()
  @IsPhoneNumber(undefined, {
    message: 'phoneE164 must be a valid phone number in E.164 format',
  })
  phoneE164!: string;

  @ApiPropertyOptional({ example: 'Priya', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({
    example: 'Met at DevFest, potential investor',
    maxLength: 2000,
    description: 'Private to you — never shown to the recipient.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
