import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsISO8601, IsOptional, IsString, MinLength } from "class-validator";

export class LinkGoogleProviderDto {
  @ApiPropertyOptional({
    description: "Google OAuth access token (Supabase session.provider_token).",
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  providerAccessToken?: string;

  @ApiPropertyOptional({
    description:
      "Google OAuth refresh token (Supabase session.provider_refresh_token). Required to persist credentials.",
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  providerRefreshToken?: string;

  @ApiPropertyOptional({
    description:
      "Token expiry date/time in ISO8601 (optional). If omitted, API will store null.",
    example: "2026-05-13T12:34:56.000Z",
  })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @ApiPropertyOptional({
    description:
      "Space-delimited Google OAuth scope string (optional). Stored as-is when provided.",
    example:
      "openid email profile https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/calendar.readonly",
  })
  @IsOptional()
  @IsString()
  scope?: string;
}
