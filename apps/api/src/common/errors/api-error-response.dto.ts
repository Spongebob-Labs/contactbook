import { ApiProperty } from '@nestjs/swagger';

/**
 * Documents the shape AllExceptionsFilter actually produces. Every endpoint's
 * error @ApiResponse() should reference this rather than re-describing the
 * envelope inline — one shape, one place it's defined.
 */
export class ApiErrorResponseDto {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({
    example: 'OTP_INVALID',
    description: 'Stable, machine-readable — branch on this, not on `message`.',
  })
  code!: string;

  @ApiProperty({ example: 'That code is incorrect.' })
  message!: string;

  @ApiProperty({
    example: '3f9c1b7e-4a2d-4b8e-9c1a-1b2c3d4e5f6a',
    description:
      'Matches the X-Request-Id response header — hand this to support to find the exact log line.',
  })
  requestId!: string;

  @ApiProperty({ required: false, example: { retryAfterSeconds: 42 } })
  details?: Record<string, unknown>;
}
