import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WebhooksService } from './webhooks.service';
import { ListInboundMessagesQueryDto } from './dto/list-inbound-messages-query.dto';
import { InboundMessageResponseDto } from './dto/inbound-message-response.dto';

/**
 * Any authenticated user can read this — same posture as GET /templates
 * (not scoped per-owner, since a raw inbound message doesn't resolve to any
 * particular ContactBook user yet; see webhooks.service.ts). Not something
 * an end-user screen would ever call; this is an ops/debugging surface for
 * now, same category as /templates.
 */
@ApiTags('webhooks')
@ApiBearerAuth('access-token')
@ApiCookieAuth('cb_access_token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'inbound-messages', version: '1' })
export class InboundMessagesController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @ApiOperation({
    summary: 'Raw history of inbound WhatsApp messages',
    description:
      'Every message that has hit our WhatsApp number, from anyone, whether or not it ' +
      'resolves to a known Contact or User — no ownership scoping, this is a raw capture. ' +
      'Newest first, capped at 500 rows per call.',
  })
  @ApiResponse({ status: 200, type: [InboundMessageResponseDto] })
  async list(
    @Query() query: ListInboundMessagesQueryDto,
  ): Promise<InboundMessageResponseDto[]> {
    return this.webhooks.list(query);
  }
}
