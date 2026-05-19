import { Body, Controller, Delete, Get, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { GoogleService } from "./google.service";
import { LinkGoogleProviderDto } from "./dto/link-google-provider.dto";

@ApiTags("Integrations / Google")
@Controller({ path: "integrations/google", version: "1" })
export class GoogleController {
  constructor(private readonly google: GoogleService) {}

  @Post("link-provider")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary:
      "Link Google provider tokens (Supabase session) to the current user.",
    description:
      "Provider tokens are encrypted at rest (AES-256-GCM) and never returned to the client. Requires a refresh token to persist credentials.",
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
      providerAccessToken: dto.providerAccessToken ?? "",
      providerRefreshToken: dto.providerRefreshToken ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      scope: dto.scope ?? null,
    });
    return { ok: true };
  }

  @Delete("disconnect")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Disconnect linked Google account" })
  @ApiOkResponse({
    description: "Google account disconnected",
    schema: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
      },
    },
  })
  async disconnect(@CurrentUser() user: JwtUserPayload): Promise<{ ok: true }> {
    await this.google.disconnectGoogle(user.sub);
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
      properties: {
        syncMode: { type: "string", enum: ["full", "delta"] },
        processedCount: { type: "number" },
        totalContacts: { type: "number" },
        lastSyncAt: { type: "string", format: "date-time", nullable: true },
      },
    },
  })
  sync(@CurrentUser() user: JwtUserPayload) {
    return this.google.syncContacts(user.sub);
  }
}
