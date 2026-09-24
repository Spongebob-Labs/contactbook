import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString } from 'class-validator';

export class ConnectSendDto {
  @ApiProperty({
    example: '+919876543210',
    description:
      "The scanner's own phone, E.164 format including the leading +. " +
      "Never the card owner's. Format-validated only — this endpoint does " +
      'NOT verify it belongs to the caller (no OTP, no WhatsApp-tap ' +
      'self-verification). See CardConnectController for why.',
  })
  @IsString()
  @IsPhoneNumber(undefined, {
    message: 'phoneE164 must be a valid phone number in E.164 format',
  })
  phoneE164!: string;
}
