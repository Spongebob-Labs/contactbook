import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
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
import { ShareLinksService } from './share-links.service';
import { UpdateShareLinkDto } from './dto/update-share-link.dto';
import { ShareLinkResponseDto } from './dto/share-link-response.dto';

@ApiTags('share-links')
@ApiBearerAuth('access-token')
@ApiCookieAuth('cb_access_token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'share-links', version: '1' })
export class ShareLinksController {
  constructor(private readonly shareLinks: ShareLinksService) {}

  @Get()
  @ApiOperation({ summary: 'List every share link across all your cards' })
  @ApiResponse({ status: 200, type: [ShareLinkResponseDto] })
  async list(@Req() req: Request) {
    return this.shareLinks.list(req.user!.id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Revoke or restore a share link',
    description:
      'Restoring reuses the same token — see POST /cards/:id/share for why a link is never re-minted.',
  })
  @ApiResponse({ status: 200, type: ShareLinkResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'SHARE_LINK_NOT_FOUND',
  })
  async updateStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateShareLinkDto,
  ) {
    return this.shareLinks.updateStatus(req.user!.id, id, dto);
  }
}
