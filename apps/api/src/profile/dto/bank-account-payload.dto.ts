import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class BankAccountPayloadDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  bankName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  accountHolder!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  accountNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  iban?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  swiftBic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  routingNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  ifsc?: string;

  @ApiPropertyOptional({ default: "USD" })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}
