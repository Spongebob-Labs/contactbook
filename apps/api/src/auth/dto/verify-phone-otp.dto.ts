import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, Matches } from "class-validator";

export class VerifyPhoneOtpDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\+\d{10,15}$/)
  phoneE164!: string;

  @ApiProperty()
  @IsString()
  @Length(6, 6)
  code!: string;
}
