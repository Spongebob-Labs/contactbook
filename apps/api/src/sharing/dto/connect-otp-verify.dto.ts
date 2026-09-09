import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString, Length, Matches } from 'class-validator';

export class ConnectOtpVerifyDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsPhoneNumber(undefined, {
    message: 'phoneE164 must be a valid phone number in E.164 format',
  })
  phoneE164!: string;

  @ApiProperty({
    example: '073602',
    description: 'The 6-digit code delivered over WhatsApp.',
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}
