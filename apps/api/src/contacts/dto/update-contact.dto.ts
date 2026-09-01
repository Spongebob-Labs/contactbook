import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// No phoneE164 here — it is the identity key a Contact is upserted by
// (ownerId, phoneE164) is unique. Changing it would make this a different
// contact, not an edit; delete and re-add instead.
export class UpdateContactDto {
  @ApiPropertyOptional({ example: 'Priya', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({
    example: 'Met at DevFest, potential investor',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
