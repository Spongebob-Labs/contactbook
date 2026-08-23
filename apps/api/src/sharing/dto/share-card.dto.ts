import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
} from 'class-validator';

export class ShareCardDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'E.164 format. Upserted into your recipient registry if new.',
  })
  @IsString()
  @IsPhoneNumber(undefined, {
    message: 'recipientPhoneE164 must be a valid phone number in E.164 format',
  })
  recipientPhoneE164!: string;

  @ApiPropertyOptional({ example: 'Priya', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  recipientDisplayName?: string;
}
