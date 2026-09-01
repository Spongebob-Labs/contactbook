import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ImportContactEntryDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'E.164 format, including the leading +.',
  })
  @IsString()
  @IsPhoneNumber(undefined, {
    message: 'phoneE164 must be a valid phone number in E.164 format',
  })
  phoneE164!: string;

  @ApiPropertyOptional({
    example: 'Priya',
    maxLength: 120,
    description:
      'Whatever the imported source (device address book, CSV, ...) called them.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;
}

export class ImportContactsDto {
  @ApiProperty({
    type: [ImportContactEntryDto],
    description:
      'Typically the caller’s device address book, handed over however the client sourced it — this endpoint doesn’t care whether that was a native Contacts API, a CSV, or a manual multi-add.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportContactEntryDto)
  contacts!: ImportContactEntryDto[];
}
