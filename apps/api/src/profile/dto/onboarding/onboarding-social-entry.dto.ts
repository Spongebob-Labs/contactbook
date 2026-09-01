import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CustomFieldsDto } from '../custom-fields.dto';

// No fixed platform fields on purpose — a social profile is just "a tag and
// whatever handles/links the user wants to attach", carried entirely in
// `custom`. Adding a named field per platform (skype, discord, ...) would
// mean a schema change every time a new platform matters to someone.
export class OnboardingSocialEntryDto extends CustomFieldsDto {
  @ApiPropertyOptional({ example: 'Personal Instagram', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tag?: string;
}
