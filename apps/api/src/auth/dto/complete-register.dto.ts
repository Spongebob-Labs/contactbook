import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CompleteRegisterDto {
  @ApiProperty({
    description:
      "JWT from POST /auth/whatsapp/verify-code when the phone is not yet registered.",
  })
  @IsString()
  @MinLength(20)
  phoneVerificationToken!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ description: "E.164 phone number", example: "+15551234567" })
  @IsString()
  @Matches(/^\+\d{10,15}$/)
  phoneE164!: string;

  @ApiProperty({
    description: "ISO 3166-1 alpha-2 country code for the phone (e.g. US, GB).",
    example: "US",
  })
  @IsString()
  @Length(2, 2)
  @Matches(/^[a-zA-Z]{2}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase() : value,
  )
  countryCode!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;
}
