import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { GoogleService } from "./google.service";

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
  oauthUrl(@CurrentUser() user: JwtUserPayload): { url: string } {
    return { url: this.google.createAuthUrl(user.sub) };
  }

  @Get("callback")
  @ApiOperation({ summary: "Google OAuth redirect/callback" })
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

  @Get("sync")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Run Google People contacts sync" })
  sync(@CurrentUser() user: JwtUserPayload) {
    return this.google.syncContacts(user.sub);
  }
}
