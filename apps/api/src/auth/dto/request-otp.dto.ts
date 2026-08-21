import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'E.164 format, including the leading +.',
  })
  @IsString()
  @IsPhoneNumber(undefined, {
    message: 'phoneE164 must be a valid phone number in E.164 format',
  })
  phoneE164!: string;
}
