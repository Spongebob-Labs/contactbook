import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PostalAddressDto } from '../postal-address.dto';
import { CustomFieldsDto } from '../custom-fields.dto';

export class OnboardingPersonalDto extends CustomFieldsDto {
  @ApiPropertyOptional({ type: PostalAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PostalAddressDto)
  postalAddress?: PostalAddressDto;
}
