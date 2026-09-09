import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectOtpRequestResultDto {
  @ApiProperty({ example: true })
  sent!: true;

  @ApiPropertyOptional({
    example: '073602',
    description:
      "Only ever present outside production when Twilio isn't configured — " +
      'lets the whole connect flow be testable before real credentials exist.',
  })
  devCode?: string;
}
