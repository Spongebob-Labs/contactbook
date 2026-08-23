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
import { CardsService } from './cards.service';
import { ShareLinksService } from './share-links.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { SetCardFieldsDto } from './dto/set-card-fields.dto';
import { ShareCardDto } from './dto/share-card.dto';
import { ListCardsQueryDto } from './dto/list-cards-query.dto';
import { CardResponseDto } from './dto/card-response.dto';
import { ShareLinkResponseDto } from './dto/share-link-response.dto';

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
    summary: 'Share this card with a recipient',
    description:
      'Mints (or reuses — see architecture invariant #1) the ShareLink for this (card, ' +
      'recipient) pair and returns its live URL. Does NOT send a WhatsApp message yet — that ' +
      'lands once a CARD_SHARE template is registered and approved (POST /templates). Copy the ' +
      'returned url manually for now.',
  })
  @ApiResponse({ status: 201, type: ShareLinkResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'CARD_NOT_FOUND',
  })
  @HttpCode(201)
  async share(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ShareCardDto,
  ) {
    return this.shareLinks.share(req.user!.id, id, dto);
  }
}
