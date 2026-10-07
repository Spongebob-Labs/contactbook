import { Controller, Get, Header, Param, Req, UseGuards } from '@nestjs/common';
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
import { GoogleWalletSaveUrlResponseDto } from './dto/google-wallet-save-url-response.dto';

@ApiTags('wallet')
@ApiBearerAuth('access-token')
@ApiCookieAuth('cb_access_token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'cards', version: '1' })
export class GoogleWalletController {
  constructor(private readonly googleWallet: GoogleWalletService) {}

  @Get(':id/google-wallet-pass')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get a Save to Google Wallet link for a card',
    description:
      "Creates or refreshes the card's pass in Google Wallet from the card's current " +
      'data, then returns a signed "Save to Google Wallet" link for the client to ' +
      "navigate to. The pass carries the owner's name, the card name, the headline and " +
      "a QR code of the card's live public URL — no field values and no phone numbers. " +
      'Later edits and archives reach saved passes on their own. Returns 404 if the ' +
      'card does not belong to the caller or is archived; 409 if Google Wallet is not ' +
      'configured on this server.',
  })
  @ApiResponse({
    status: 200,
    description: 'The link to send the browser to.',
    type: GoogleWalletSaveUrlResponseDto,
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
  ): Promise<GoogleWalletSaveUrlResponseDto> {
    const url = await this.googleWallet.getSaveUrl(req.user!.id, cardId);
    return { url };
  }
}
