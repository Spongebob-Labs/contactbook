import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    required: false,
    description:
      'Optional — normally omitted, since the refresh token travels as the httpOnly cb_refresh_token cookie instead. Provided here only for non-browser clients that cannot hold a cookie.',
  })
  @IsString()
  refreshToken!: string;
}
