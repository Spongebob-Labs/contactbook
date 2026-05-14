import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from "class-validator";
import { normalizeDialCode } from "../../common/phone.util";

export class CreateConnectionRequestDto {
  @ApiProperty({
    description:
      "Recipient national phone number (digits only, must match a registered user).",
    example: "5559876543",
  })
  @IsString()
  @Matches(/^\d{4,15}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? value.replace(/\D/g, "") : value,
  )
  recipientPhone!: string;

  @ApiProperty({
    description: "Recipient E.164 country calling code prefix (e.g. +1, +44).",
    example: "+1",
  })
  @IsString()
  @Matches(/^\+\d{1,4}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? normalizeDialCode(value) : value,
  )
  recipientCountryCode!: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  initiatorSharedCardId!: string;

  @ApiPropertyOptional({ description: "ISO datetime when share access ends" })
  @IsOptional()
  @IsISO8601()
  shareExpiresAt?: string;
}
