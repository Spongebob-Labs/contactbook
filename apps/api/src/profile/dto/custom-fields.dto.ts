import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

/** Arbitrary user-named key/value pairs, e.g. a social platform handle keyed
 *  by platform name. class-validator has no clean "map of strings" decorator,
 *  so shape (string keys, string values) and size are enforced in
 *  OnboardingService.validateCustomFields rather than here — that keeps the
 *  DTO honest about what it actually guarantees at the HTTP boundary. */
export class CustomFieldsDto {
  @ApiPropertyOptional({
    example: { skype: 'ada.lovelace', discord: 'ada#1234' },
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  custom?: Record<string, unknown>;
}
