import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { normalizeDialCode } from "../../common/phone.util";

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
  @MaxLength(120)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName!: string;

  @ApiProperty({
    description:
      "National phone number (digits only, must match verification).",
    example: "5551234567",
  })
  @IsString()
  @Matches(/^\d{4,15}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? value.replace(/\D/g, "") : (value as unknown),
  )
  phone!: string;

  @ApiProperty({
    description: "E.164 country calling code prefix (e.g. +1, +44).",
    example: "+1",
  })
  @IsString()
  @Matches(/^\+\d{1,4}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? normalizeDialCode(value) : (value as unknown),
  )
  countryCode!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;
}
