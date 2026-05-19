import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, Matches } from "class-validator";
import { normalizeDialCode } from "../../common/phone.util";

export class RequestWhatsappCodeDto {
  @ApiProperty({
    description:
      "National phone number without country calling code (digits only, e.g. 5551234567).",
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
}
