import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { RecipientsService } from './recipients.service';
import { UpsertRecipientDto } from './dto/upsert-recipient.dto';
import { UpdateRecipientDto } from './dto/update-recipient.dto';
import { RecipientResponseDto } from './dto/recipient-response.dto';

/**
 * Your private registry of people you've shared with. There is no "list
 * recipients for user X" — every route acts on the caller's own registry,
 * scoped by req.user.id at the query level.
 */
@ApiTags('recipients')
@ApiBearerAuth('access-token')
@ApiCookieAuth('cb_access_token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'recipients', version: '1' })
export class RecipientsController {
  constructor(private readonly recipients: RecipientsService) {}

  @Get()
  @ApiOperation({ summary: 'List your recipients' })
  @ApiResponse({ status: 200, type: [RecipientResponseDto] })
  async list(@Req() req: Request) {
    return this.recipients.list(req.user!.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one recipient' })
  @ApiResponse({ status: 200, type: RecipientResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'RECIPIENT_NOT_FOUND',
  })
  async getOne(@Req() req: Request, @Param('id') id: string) {
    return this.recipients.getOne(req.user!.id, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a recipient, or update one that already exists',
    description:
      'Upserts on (you, phoneE164) — calling this again for a number already in your ' +
      'registry updates displayName/notes rather than erroring. You do not need to call this ' +
      'before sharing a card with someone; POST /cards/:id/share does it for you.',
  })
  @ApiResponse({ status: 200, type: RecipientResponseDto })
  async upsert(@Req() req: Request, @Body() dto: UpsertRecipientDto) {
    return this.recipients.upsertByPhone(req.user!.id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a recipient’s display name or notes',
    description:
      'phoneE164 is not editable here — it is the identity a recipient is matched by.',
  })
  @ApiResponse({ status: 200, type: RecipientResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'RECIPIENT_NOT_FOUND',
  })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRecipientDto,
  ) {
    return this.recipients.update(req.user!.id, id, dto);
  }
}
