import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class RefreshSessionDto {
  @ApiProperty({ description: "Opaque refresh token from login or register." })
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}
