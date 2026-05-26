import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateIf,
} from "class-validator";
import { normalizeDialCode } from "../../common/phone.util";

export class CreateConnectionRequestDto {
  @ApiPropertyOptional({
    description:
      "Recipient national phone (digits only). Required unless recipientContactId is set.",
    example: "5559876543",
  })
  @ValidateIf((o: CreateConnectionRequestDto) => !o.recipientContactId)
  @IsString()
  @Matches(/^\d{4,15}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? value.replace(/\D/g, "") : (value as unknown),
  )
  recipientPhone?: string;

  @ApiPropertyOptional({
    description: "Recipient E.164 country code. Required with recipientPhone.",
    example: "+1",
  })
  @ValidateIf((o: CreateConnectionRequestDto) => !o.recipientContactId)
  @IsString()
  @Matches(/^\+\d{1,4}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? normalizeDialCode(value) : (value as unknown),
  )
  recipientCountryCode?: string;

  @ApiPropertyOptional({
    description:
      "Recipient from the requester's imported contacts (alternative to phone fields).",
  })
  @ValidateIf(
    (o: CreateConnectionRequestDto) =>
      !o.recipientPhone && !o.recipientCountryCode,
  )
  @IsUUID()
  recipientContactId?: string;
}
