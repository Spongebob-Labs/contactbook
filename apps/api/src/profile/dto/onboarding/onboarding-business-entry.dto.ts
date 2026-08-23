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

// businessLogo omitted — same reasoning as OnboardingWorkEntryDto.companyLogo.
export class OnboardingBusinessEntryDto extends CustomFieldsDto {
  @ApiPropertyOptional({ example: 'Freelance Design Co', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tag?: string;

  @ApiPropertyOptional({ example: 'Freelance Design Co', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @ApiPropertyOptional({ example: 'Owner', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  businessTitle?: string;

  @ApiPropertyOptional({ type: PostalAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PostalAddressDto)
  businessPostalAddress?: PostalAddressDto;
}
