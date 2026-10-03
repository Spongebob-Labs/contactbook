import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiErrorResponseDto } from '../common/errors/api-error-response.dto';
import { WalletPassService } from './wallet-pass.service';

@ApiTags('wallet')
@ApiBearerAuth('access-token')
@ApiCookieAuth('cb_access_token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'cards', version: '1' })
export class WalletPassController {
  constructor(private readonly walletPass: WalletPassService) {}

  @Get(':id/wallet-pass')
  @ApiOperation({
    summary: 'Download Apple Wallet pass for a card',
    description:
      'Builds and returns a signed .pkpass file. The pass contains the owner\'s name, ' +
      'card headline, and a QR code that encodes the card\'s live public URL — no field ' +
      'values are embedded. Returns 404 if the card does not belong to the caller or is ' +
      'archived; 409 if Apple Wallet signing is not configured on this server.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Signed .pkpass file — iOS opens the "Add to Wallet" sheet when this is received ' +
      'by Safari with this content type.',
    content: {
      'application/vnd.apple.pkpass': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'CARD_NOT_FOUND — card does not belong to the caller, or is archived.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'WALLET_NOT_CONFIGURED — Apple Wallet signing is not enabled on this server.',
    type: ApiErrorResponseDto,
  })
  async downloadWalletPass(
    @Req() req: Request,
    @Param('id') cardId: string,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.user!.id;
    const buffer = await this.walletPass.buildPassForCard(userId, cardId);
    const slug = cardId.slice(0, 8);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${slug}.pkpass"`,
    );
    res.send(buffer);
  }
}
