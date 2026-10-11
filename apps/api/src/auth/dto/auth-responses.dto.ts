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

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'Same token as the cb_access_token cookie, returned here too so non-browser clients ' +
      '(mobile apps, scripts, Postman) can use it directly as an Authorization: Bearer header ' +
      'instead of relying on cookies. 15-minute lifetime. The refresh token is deliberately ' +
      'NOT included here — it is long-lived (30 days) and stays httpOnly-cookie-only to limit ' +
      'its exposure to XSS; only the short-lived access token trades that protection for ' +
      'portability.',
  })
  accessToken!: string;

  @ApiProperty({
    example: false,
    description:
      'Whether POST /profile/onboarding has been completed. ' +
      'false → new user, redirect to onboarding; true → returning user, proceed to the app.',
  })
  isOnboardingCompleted!: boolean;
}

export class RefreshResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'A freshly issued access token — see VerifyOtpResponseDto for why only this one is returned.',
  })
  accessToken!: string;
}

export class OkResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;
}

export class AuthMeResponseDto {
  @ApiProperty({ example: '28dac79d-8053-493f-a81b-9135b8a6966e' })
  id!: string;

  @ApiProperty({ example: '+919347243575' })
  phoneE164!: string;

  @ApiProperty({
    example: false,
    description: 'Whether POST /profile/onboarding has been completed.',
  })
  isOnboardingCompleted!: boolean;
}
