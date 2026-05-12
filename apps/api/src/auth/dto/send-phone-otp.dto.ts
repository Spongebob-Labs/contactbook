import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export class SendPhoneOtpDto {
  @ApiProperty({ description: "E.164 phone number", example: "+15551234567" })
  @IsString()
  @Matches(/^\+\d{10,15}$/)
  phoneE164!: string;
}
