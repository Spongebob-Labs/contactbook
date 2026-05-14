import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class RefreshSessionDto {
  @ApiPropertyOptional({
    description:
      "Opaque refresh token. Optional when `cb_refresh_token` httpOnly cookie is sent (browser).",
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  refreshToken?: string;
} 