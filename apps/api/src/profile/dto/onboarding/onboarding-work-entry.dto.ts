import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PostalAddressDto } from '../postal-address.dto';
import { CustomFieldsDto } from '../custom-fields.dto';

/**
 * companyLogo is deliberately absent — same reasoning as profilePhoto: a
 * logo is an image, and accepting a raw client-supplied URL here would be
 * the exact bypass POST /profile/photo exists to prevent. A "company logo
 * upload" endpoint is a real future feature, not something to sneak in as a
 * plain string field.
 */
export class OnboardingWorkEntryDto extends CustomFieldsDto {
  @ApiPropertyOptional({ example: 'Acme Corp', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tag?: string;

  @ApiPropertyOptional({ example: 'Acme Corp', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional({ example: 'Senior Engineer', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  workTitle?: string;

  @ApiPropertyOptional({ type: PostalAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PostalAddressDto)
  workPostalAddress?: PostalAddressDto;
}
