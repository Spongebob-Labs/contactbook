import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { ContactsService } from './contacts.service';
import { UpsertContactDto } from './dto/upsert-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ImportContactsDto } from './dto/import-contacts.dto';
import { ContactResponseDto } from './dto/contact-response.dto';
import { ImportContactsResponseDto } from './dto/import-contacts-response.dto';

/**
 * Your private registry of people you've shared with. There is no "list
 * contacts for user X" — every route acts on the caller's own registry,
 * scoped by req.user.id at the query level.
 */
@ApiTags('contacts')
@ApiBearerAuth('access-token')
@ApiCookieAuth('cb_access_token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'contacts', version: '1' })
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'List your contacts' })
  @ApiResponse({ status: 200, type: [ContactResponseDto] })
  async list(@Req() req: Request) {
    return this.contacts.list(req.user!.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one contact' })
  @ApiResponse({ status: 200, type: ContactResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'CONTACT_NOT_FOUND',
  })
  async getOne(@Req() req: Request, @Param('id') id: string) {
    return this.contacts.getOne(req.user!.id, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a contact, or update one that already exists',
    description:
      'Upserts on (you, phoneE164) — calling this again for a number already in your ' +
      'registry updates displayName/notes rather than erroring. For adding many at once ' +
      '(e.g. a device address book), use POST /contacts/import instead.',
  })
  @ApiResponse({ status: 200, type: ContactResponseDto })
  async upsert(@Req() req: Request, @Body() dto: UpsertContactDto) {
    return this.contacts.upsertByPhone(req.user!.id, dto);
  }

  @Post('import')
  @ApiOperation({
    summary: 'Bulk-add contacts',
    description:
      'The expected way contacts actually enter the registry — hand over an address book ' +
      'export in one call instead of one POST /contacts per person. Each entry upserts the ' +
      'same way POST /contacts does; newly-created rows are tagged source=IMPORTED.',
  })
  @ApiResponse({ status: 201, type: ImportContactsResponseDto })
  @HttpCode(201)
  async import(@Req() req: Request, @Body() dto: ImportContactsDto) {
    return this.contacts.import(req.user!.id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a contact’s display name or notes',
    description:
      'phoneE164 is not editable here — it is the identity a contact is matched by.',
  })
  @ApiResponse({ status: 200, type: ContactResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'CONTACT_NOT_FOUND',
  })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contacts.update(req.user!.id, id, dto);
  }
}
