import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ApiExceptionFilter } from "../common/filters/api-exception.filter";
import { WalletService } from "./wallet.service";

@ApiTags("Wallet")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller({ path: "wallet", version: "1" })
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get("status")
  @ApiOperation({
    summary: "Whether Wallet passes can currently be issued",
    description:
      "Lets the client show or hide the Add to Apple Wallet badge instead of offering a button that cannot work.",
  })
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: { configured: { type: "boolean" } },
    },
  })
  status(): { configured: boolean } {
    return { configured: this.wallet.isConfigured() };
  }

  @Post("cards/:cardId/pass")
  @ApiOperation({ summary: "Download this card as an Apple Wallet pass" })
  @ApiOkResponse({
    description: "A signed .pkpass bundle",
    content: { "application/vnd.apple.pkpass": {} },
  })
  @ApiServiceUnavailableResponse({
    description: "No Pass Type ID certificate is configured yet.",
  })
  async pass(
    @CurrentUser() user: JwtUserPayload,
    @Param("cardId", ParseUUIDPipe) cardId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, bytes } = await this.wallet.buildPass(user.sub, cardId);

    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    // Passes are signed per request and carry personal details; never cache.
    res.setHeader("Cache-Control", "no-store");
    res.send(bytes);
  }
}
