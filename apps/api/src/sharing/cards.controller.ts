import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiErrorResponseDto } from '../common/errors/api-error-response.dto';
import { MAX_LOGO_BYTES } from './card-logo-storage.service';
import { CardsService } from './cards.service';
import { ShareLinksService } from './share-links.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { SetCardFieldsDto } from './dto/set-card-fields.dto';
import { ShareCardDto } from './dto/share-card.dto';
import { ListCardsQueryDto } from './dto/list-cards-query.dto';
import { CardResponseDto } from './dto/card-response.dto';
import { ShareLinkResponseDto } from './dto/share-link-response.dto';
import { AudienceResponseDto } from './dto/audience-response.dto';
import { NotifyCardDto } from './dto/notify-card.dto';
import { NotifyResultDto } from './dto/notify-result.dto';

@ApiTags('cards')
@ApiBearerAuth('access-token')
@ApiCookieAuth('cb_access_token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'cards', version: '1' })
export class CardsController {
  constructor(
    private readonly cards: CardsService,
    private readonly shareLinks: ShareLinksService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List your cards',
    description: 'Archived cards are excluded unless includeArchived=true.',
  })
  @ApiResponse({ status: 200, type: [CardResponseDto] })
  async list(@Req() req: Request, @Query() query: ListCardsQueryDto) {
    return this.cards.list(req.user!.id, query.includeArchived ?? false);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one card',
    description:
      'Includes its curated field list, resolved and decrypted — the same view an edit screen would render.',
  })
  @ApiResponse({ status: 200, type: CardResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'CARD_NOT_FOUND',
  })
  async getOne(@Req() req: Request, @Param('id') id: string) {
    return this.cards.getOne(req.user!.id, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a card',
    description: 'Starts with no fields — add them with PUT /cards/:id/fields.',
  })
  @ApiResponse({ status: 201, type: CardResponseDto })
  @HttpCode(201)
  async create(@Req() req: Request, @Body() dto: CreateCardDto) {
    return this.cards.create(req.user!.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or recategorize a card' })
  @ApiResponse({ status: 200, type: CardResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'CARD_NOT_FOUND',
  })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCardDto,
  ) {
    return this.cards.update(req.user!.id, id, dto);
  }

  @Post(':id/logo')
  @ApiOperation({
    summary: 'Upload or replace this card’s logo',
    description: `JPEG, PNG, or WebP, up to ${MAX_LOGO_BYTES / (1024 * 1024)} MB. Replacing an existing logo deletes the old one from storage.`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 200, type: CardResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'CARD_NOT_FOUND',
  })
  @ApiResponse({
    status: 409,
    type: ApiErrorResponseDto,
    description: 'LOGO_STORAGE_NOT_CONFIGURED',
  })
  @ApiResponse({
    status: 413,
    type: ApiErrorResponseDto,
    description: 'LOGO_TOO_LARGE',
  })
  @ApiResponse({
    status: 415,
    type: ApiErrorResponseDto,
    description: 'LOGO_TYPE_UNSUPPORTED',
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_LOGO_BYTES } }),
  )
  async uploadLogo(
    @Req() req: Request,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.cards.uploadLogo(req.user!.id, id, file);
  }

  @Delete(':id/logo')
  @ApiOperation({ summary: 'Remove this card’s logo' })
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Removed.' })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'CARD_NOT_FOUND or LOGO_NOT_FOUND',
  })
  async removeLogo(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<void> {
    await this.cards.removeLogo(req.user!.id, id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Archive a card',
    description:
      'Also revokes every active ShareLink on this card — recipients get a 410, not a silently-still-working link.',
  })
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Archived.' })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'CARD_NOT_FOUND',
  })
  async archive(@Req() req: Request, @Param('id') id: string): Promise<void> {
    await this.cards.archive(req.user!.id, id);
  }

  @Put(':id/fields')
  @ApiOperation({
    summary: 'Replace this card’s curated field set',
    description:
      'All-or-nothing: every fieldId must be one of your own, non-archived, non-PHOTO ' +
      'ProfileFields, or nothing changes. This REPLACES the whole set — send everything you ' +
      'want kept, not just what changed.',
  })
  @ApiResponse({ status: 200, type: CardResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'CARD_NOT_FOUND or PROFILE_FIELD_NOT_FOUND',
  })
  @ApiResponse({
    status: 409,
    type: ApiErrorResponseDto,
    description: 'DUPLICATE_FIELD_IN_CARD or PHOTO_NOT_A_CARD_FIELD',
  })
  async setFields(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SetCardFieldsDto,
  ) {
    return this.cards.setFields(req.user!.id, id, dto);
  }

  @Post(':id/share')
  @ApiOperation({
    summary: 'Share this card with a contact',
    description:
      'Mints (or reuses — see architecture invariant #1) the ShareLink for this (card, ' +
      'contact) pair and enqueues a WhatsApp send via the outbox. The send only actually goes ' +
      'out once a CARD_SHARE WhatsAppTemplate is registered and approved (POST /templates) — ' +
      'until then it fails cleanly with CARD_SHARE_TEMPLATE_NOT_CONFIGURED, but the returned ' +
      'url is real and live regardless, so copying it manually always works. Calling this ' +
      'again on an already-active link is a no-op on the messaging side — nothing re-sends.',
  })
  @ApiResponse({ status: 201, type: ShareLinkResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'CARD_NOT_FOUND or CONTACT_NOT_FOUND',
  })
  @HttpCode(201)
  async share(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ShareCardDto,
  ) {
    return this.shareLinks.share(req.user!.id, id, dto);
  }

  @Get(':id/audience')
  @ApiOperation({
    summary: 'List active recipients and how far behind each one is',
    description:
      'Active ShareLinks only — a revoked or never-shared contact has no link to notify. ' +
      'versionsBehind is currentVersion minus the version each recipient was last told about, ' +
      'via either the initial share or a previous notify.',
  })
  @ApiResponse({ status: 200, type: AudienceResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'CARD_NOT_FOUND',
  })
  async getAudience(@Req() req: Request, @Param('id') id: string) {
    return this.cards.getAudience(req.user!.id, id);
  }

  @Post(':id/notify')
  @ApiOperation({
    summary:
      'Send a generic "this card was updated" WhatsApp notice to chosen recipients',
    description:
      'The message carries no field-level diff — just a pointer at the live link. Each ' +
      'shareLinkId must be an ACTIVE link on this card. Fails cleanly with ' +
      'CARD_UPDATE_TEMPLATE_NOT_CONFIGURED until a CARD_UPDATE WhatsAppTemplate is registered ' +
      'and approved (POST /templates). Re-notifying the same recipient about a version already ' +
      'notified is a no-op, not a duplicate send.',
  })
  @ApiResponse({ status: 201, type: [NotifyResultDto] })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'CARD_NOT_FOUND or SHARE_LINK_NOT_FOUND',
  })
  @HttpCode(201)
  async notify(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: NotifyCardDto,
  ) {
    return this.cards.notify(req.user!.id, id, dto);
  }
}
