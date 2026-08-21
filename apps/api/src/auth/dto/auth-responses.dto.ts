import { ApiProperty } from '@nestjs/swagger';

export class RequestOtpResponseDto {
  @ApiProperty({ example: true })
  sent!: boolean;

  @ApiProperty({
    required: false,
    example: '073602',
    description:
      'Present ONLY outside production, and only when Twilio is not configured. ' +
      'Lets the whole login flow be tested before real credentials exist. Never sent otherwise, never logged.',
  })
  devCode?: string;
}

export class VerifyOtpResponseDto {
  @ApiProperty({ example: '28dac79d-8053-493f-a81b-9135b8a6966e' })
  userId!: string;
}

export class OkResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;
}

export class MeResponseDto {
  @ApiProperty({ example: '28dac79d-8053-493f-a81b-9135b8a6966e' })
  id!: string;

  @ApiProperty({ example: '+919347243575' })
  phoneE164!: string;

  @ApiProperty({
    nullable: true,
    example: null,
    description: 'Null until the owner completes profile setup.',
  })
  displayName!: string | null;
}
