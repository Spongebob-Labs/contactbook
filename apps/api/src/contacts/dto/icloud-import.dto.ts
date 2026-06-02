import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class IcloudImportDto {
  @ApiProperty({
    description:
      "Primary email address associated with the Apple ID (e.g. user@gmail.com or user@icloud.com)",
    example: "user@gmail.com",
  })
  @IsEmail()
  appleId!: string;

  @ApiProperty({
    description:
      "Apple App-Specific Password generated on account.apple.com (formatted with hyphens)",
    example: "abcd-efgh-ijkl-mnop",
  })
  @IsNotEmpty()
  @IsString()
  appSpecificPassword!: string;
}
