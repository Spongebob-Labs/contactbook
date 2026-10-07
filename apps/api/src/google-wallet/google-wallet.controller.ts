import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiErrorResponseDto } from '../common/errors/api-error-response.dto';
import { GoogleWalletService } from './google-wallet.service';

@ApiTags('wallet')
@ApiBearerAuth('access-token')
@ApiCookieAuth('cb_access_token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'cards', version: '1' })
export class GoogleWalletController {
  constructor(private readonly googleWallet: GoogleWalletService) {}

  @Get(':id/google-wallet-pass')
  @ApiOperation({
    summary: 'Get a Save to Google Wallet URL for a card',
    description:
      'Creates or updates the pass object in Google Wallet and returns a signed Save URL. ' +
      'The caller must own the card. Returns 409 if Google Wallet is not configured on this server.',
  })
  @ApiResponse({
    status: 200,
    description: 'Signed Save to Google Wallet URL.',
    schema: {
      properties: {
        url: {
          type: 'string',
          example:
            'https://pay.google.com/gp/v/save/eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
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
    description:
      'CARD_NOT_FOUND — card does not belong to the caller, or is archived.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'GOOGLE_WALLET_NOT_CONFIGURED — Google Wallet is not enabled on this server.',
    type: ApiErrorResponseDto,
  })
  async getSaveUrl(
    @Req() req: Request,
    @Param('id') cardId: string,
  ): Promise<{ url: string }> {
    const url = await this.googleWallet.getSaveUrl(req.user!.id, cardId);
    return { url };
  }
}
