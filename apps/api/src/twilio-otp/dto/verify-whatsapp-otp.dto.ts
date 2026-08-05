import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, Length, Matches } from "class-validator";
import { normalizeDialCode } from "../../common/phone.util";

/** Request body for verifying a WhatsApp OTP. */
export class VerifyWhatsappOtpDto {
  @ApiProperty({
    description: "National phone number (digits only, same as the send step).",
    example: "5551234567",
  })
  @IsString()
  @Matches(/^\d{4,15}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? value.replace(/\D/g, "") : (value as unknown),
  )
  phone!: string;

  @ApiProperty({
    description: "E.164 country calling code prefix (e.g. +1).",
    example: "+1",
  })
  @IsString()
  @Matches(/^\+\d{1,4}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? normalizeDialCode(value) : (value as unknown),
  )
  countryCode!: string;

  @ApiProperty({
    description: "The 6-digit code delivered on WhatsApp.",
    example: "123456",
  })
  @IsString()
  @Matches(/^\d{6}$/)
  @Length(6, 6)
  code!: string;
}
