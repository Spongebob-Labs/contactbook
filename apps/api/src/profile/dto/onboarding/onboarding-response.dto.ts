import { ApiProperty } from '@nestjs/swagger';
import { MeResponseDto } from '../me-response.dto';

export class OnboardingResponseDto extends MeResponseDto {
  @ApiProperty({ example: true })
  declare onboardingCompleted: boolean;
}
