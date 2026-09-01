import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MessagePurpose } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiErrorResponseDto } from '../common/errors/api-error-response.dto';
import { WhatsAppTemplateService } from '../messaging/whatsapp-template.service';
import { CreateWhatsAppTemplateDto } from '../messaging/dto/create-whatsapp-template.dto';
import { UpdateWhatsAppTemplateDto } from '../messaging/dto/update-whatsapp-template.dto';
import { WhatsAppTemplateResponseDto } from '../messaging/dto/whatsapp-template-response.dto';

/**
 * The DB-backed template registry. There is no notion of "admin" in this
 * app yet (single-tenant, no roles) — protected by the same auth guard as
 * everything else, not scoped to any one user's data, since templates are a
 * platform-wide resource, not something a particular owner has.
 */
@ApiTags('whatsapp-templates')
@ApiBearerAuth('access-token')
@ApiCookieAuth('cb_access_token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'templates', version: '1' })
export class WhatsAppTemplateController {
  constructor(private readonly templates: WhatsAppTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'List registered WhatsApp templates' })
  @ApiQuery({ name: 'purpose', enum: MessagePurpose, required: false })
  @ApiResponse({ status: 200, type: [WhatsAppTemplateResponseDto] })
  async list(@Query('purpose') purpose?: MessagePurpose) {
    return this.templates.list(purpose);
  }

  @Post()
  @ApiOperation({
    summary: 'Register a Twilio Content template',
    description:
      'Records a template that already exists in Twilio — this does not create anything in ' +
      'Twilio itself. Create the template in Twilio Console/Content API first, submit it for ' +
      'WhatsApp approval, then register its contentSid here.',
  })
  @ApiResponse({ status: 201, type: WhatsAppTemplateResponseDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorResponseDto,
    description: 'TEMPLATE_ALREADY_REGISTERED',
  })
  @HttpCode(201)
  async create(@Body() dto: CreateWhatsAppTemplateDto) {
    return this.templates.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a template’s approval status or active flag',
    description:
      'Nothing here checks Twilio for you — set approvalStatus after confirming in Twilio ' +
      'Console. The (currently unbuilt) reconciler cron will do this automatically later.',
  })
  @ApiResponse({ status: 200, type: WhatsAppTemplateResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'TEMPLATE_NOT_FOUND',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWhatsAppTemplateDto,
  ) {
    return this.templates.update(id, dto);
  }
}
