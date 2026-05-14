import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class AddressPayloadDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  street!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  pincode?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  country!: string;
}
