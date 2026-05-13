import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, Length, Matches } from "class-validator";

export class RequestWhatsappCodeDto {
  @ApiProperty({ description: "E.164 phone number", example: "+15551234567" })
  @IsString()
  @Matches(/^\+\d{10,15}$/)
  phoneE164!: string;

  @ApiProperty({
    description:
      "ISO 3166-1 alpha-2 country code selected with the phone (stored on registration).",
    example: "US",
  })
  @IsString()
  @Length(2, 2)
  @Matches(/^[a-zA-Z]{2}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase() : value,
  )
  countryCode!: string;
}
