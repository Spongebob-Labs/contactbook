import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from "class-validator";

export class CreateConnectionRequestDto {
  @ApiProperty({
    description: "Recipient E.164 phone number (must match a registered user)",
    example: "+15559876543",
  })
  @IsString()
  @Matches(/^\+\d{10,15}$/)
  recipientPhoneE164!: string;

  @ApiProperty()
  @IsUUID()
  initiatorSharedCardId!: string;

  @ApiPropertyOptional({ description: "ISO datetime when share access ends" })
  @IsOptional()
  @IsISO8601()
  shareExpiresAt?: string;
}
