import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Query,
  Res,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { GoogleService } from "./google.service";
import { LinkGoogleProviderDto } from "./dto/link-google-provider.dto";

@ApiTags("Integrations / Google")
@Controller({ path: "integrations/google", version: "1" })
export class GoogleController {
  constructor(private readonly google: GoogleService) {}

  @Get("oauth-url")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Get Google OAuth URL (People + Calendar read-only)",
  })
  @ApiOkResponse({
    description: "Returns the OAuth URL",
    schema: {
      type: "object",
      properties: {
        url: { type: "string" },
      },
    },
  })
  oauthUrl(@CurrentUser() user: JwtUserPayload): { url: string } {
    return { url: this.google.createAuthUrl(user.sub) };
  }

  @Get("callback")
  @ApiOperation({
    summary: "Google OAuth redirect/callback (API-owned client)",
    description:
      "Legacy path when `GOOGLE_REDIRECT_URI` points at this API. Prefer Supabase PKCE + POST /integrations/google/link-provider for browser UX.",
  })
  @ApiOkResponse({
    description: "OAuth callback successful",
    schema: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
      },
    },
  })
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!code || !state) {
      throw new BadRequestException("Missing code or state");
    }
    await this.google.handleOAuthCallback(code, state);
    res.status(200).json({ ok: true });
  }

  @Post("link-provider")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary:
      "Link Google provider tokens (Supabase session) to the current user; stored as OAuthAccount (GOOGLE).",
  })
  @ApiCreatedResponse({
    description: "Provider linked successfully",
    schema: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
      },
    },
  })
  async linkProvider(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: LinkGoogleProviderDto,
  ): Promise<{ ok: true }> {
    await this.google.linkProviderTokensForUser(user.sub, {
      providerAccessToken: dto.providerAccessToken,
      providerRefreshToken: dto.providerRefreshToken,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      scope: dto.scope ?? null,
    });
    return { ok: true };
  }

  @Get("sync")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Run Google People contacts sync" })
  @ApiOkResponse({
    description: "Contacts synced successfully",
    schema: {
      type: "object",
    },
  })
  sync(@CurrentUser() user: JwtUserPayload) {
    return this.google.syncContacts(user.sub);
  }
}
