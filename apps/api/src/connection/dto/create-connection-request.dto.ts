import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, IsUUID, Matches } from "class-validator";
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
    typeof value === "string" ? value.replace(/\D/g, "") : (value as unknown),
  )
  recipientPhone!: string;

  @ApiProperty({
    description: "Recipient E.164 country calling code prefix (e.g. +1, +44).",
    example: "+1",
  })
  @IsString()
  @Matches(/^\+\d{1,4}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? normalizeDialCode(value) : (value as unknown),
  )
  recipientCountryCode!: string;

  @ApiProperty({
    description: "Contact card the requester will share when accepted.",
  })
  @IsString()
  @IsUUID()
  sharedCardId!: string;
}
