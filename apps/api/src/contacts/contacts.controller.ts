import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Patch,
  Put,
  Query,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { ContactSource } from "@prisma/client";
import type { Express } from "express";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OAuthTokenService } from "../oauth-tokens/oauth-token.service";
import { MultipartBoundaryExceptionFilter } from "../common/filters/multipart-boundary.exception-filter";
import { MulterUploadExceptionFilter } from "../common/filters/multer-upload.exception-filter";
import { ContactsSyncService } from "./contacts-sync.service";
import { ContactsService } from "./contacts.service";
import { ContactImportResultDto } from "./dto/contact-import-result.dto";
import { toContactImportResult } from "./contact-import-result.mapper";
import { ContactImportSummaryDto } from "./dto/contact-import-summary.dto";
import { ContactListResponseDto } from "./dto/contact-list-response.dto";
import { ContactDetailDto } from "./dto/contact-response.dto";
import { ContactSyncResponseDto } from "./dto/contact-sync-response.dto";
import { SetContactGroupsDto } from "../groups/dto/group.dto";
import { SetContactTagsDto } from "../tags/dto/tag.dto";
import { IcloudImportDto } from "./dto/icloud-import.dto";
import { ListContactsQueryDto } from "./dto/list-contacts-query.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";
import { MAX_VCF_IMPORT_BYTES } from "./vcard-import.constants";
import { VcardContactsImportService } from "./vcard-contacts-import.service";
import { ApiExceptionFilter } from "../common/filters/api-exception.filter";

@ApiTags("Contacts")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller({ path: "contacts", version: "1" })
export class ContactsController {
  constructor(
    private readonly contacts: ContactsService,
    private readonly contactsSync: ContactsSyncService,
    private readonly vcardImport: VcardContactsImportService,
    private readonly oauthTokenService: OAuthTokenService,
  ) {}

  @Get("sync")
  @ApiOperation({
    summary: "Sync contacts from a provider",
    description:
      "Runs incremental provider sync when a sync token exists (Google, iCloud). On an expired token, falls back to the same full import as the provider import endpoint.",
  })
  @ApiQuery({
    name: "source",
    enum: [ContactSource.GOOGLE, ContactSource.ICLOUD],
  })
  @ApiOkResponse({ type: ContactSyncResponseDto })
  sync(
    @CurrentUser() user: JwtUserPayload,
    @Query("source", new ParseEnumPipe(ContactSource)) source: ContactSource,
  ) {
    return this.contactsSync.sync(user.sub, source);
  }

  @Get("import/google")
  @ApiOperation({
    summary: "Import contacts from Google",
    description:
      "Runs a full Google import (never uses a stored sync token), then returns counts and last sync metadata.",
  })
  @ApiOkResponse({ type: ContactImportResultDto })
  async importGoogle(@CurrentUser() user: JwtUserPayload) {
    return this.contactsSync.import(user.sub, ContactSource.GOOGLE);
  }

  @Post("import/icloud")
  @ApiOperation({
    summary: "Import contacts from iCloud",
    description:
      "Accepts Apple credentials, secures them using AES-256-GCM at rest, discovers server shards, and executes a full contact import.",
  })
  @ApiBody({ type: IcloudImportDto })
  @ApiOkResponse({ type: ContactImportResultDto })
  async importIcloud(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: IcloudImportDto,
  ) {
    await this.oauthTokenService.upsertForUser(user.sub, "icloud", {
      accessToken: body.appleId,
      refreshToken: body.appSpecificPassword,
    });
    return this.contactsSync.import(user.sub, ContactSource.ICLOUD);
  }

  @Post("import/vcf")
  @ApiOperation({
    summary: "Import contacts from a VCF file",
    description:
      "Upload a .vcf or .vcard file (max 50 MB). Parses vCards and upserts contacts with source VCARD.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "vCard export (.vcf / .vcard), up to 50 MB",
        },
      },
    },
  })
  @ApiOkResponse({ type: ContactImportResultDto })
  @UseFilters(MultipartBoundaryExceptionFilter, MulterUploadExceptionFilter)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_VCF_IMPORT_BYTES },
    }),
  )
  async importVcf(
    @CurrentUser() user: JwtUserPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    const run = await this.vcardImport.importFromFile(user.sub, file, {
      contentType: String(req.headers["content-type"] ?? ""),
    });
    return toContactImportResult(run);
  }

  @Get("import/summary")
  @ApiOperation({ summary: "Import counts and last sync metadata by source" })
  @ApiOkResponse({ type: ContactImportSummaryDto })
  importSummary(@CurrentUser() user: JwtUserPayload) {
    return this.contacts.getImportSummary(user.sub);
  }

  @Get()
  @ApiOperation({
    summary: "List contacts",
    description:
      "Paginated normalized contact records (phones, emails, organizations, addresses, urls) for the current user. Optional search matches first name, last name, and nickname.",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({
    name: "search",
    required: false,
    description:
      "Matches first name, last name, and nickname (case-insensitive).",
  })
  @ApiQuery({ name: "source", enum: ContactSource, required: false })
  @ApiQuery({
    name: "tagIds",
    required: false,
    description: "Comma-separated tag UUIDs (AND filter)",
  })
  @ApiQuery({
    name: "groupIds",
    required: false,
    description: "Comma-separated group UUIDs (AND filter)",
  })
  @ApiQuery({
    name: "sort",
    required: false,
    enum: ["name", "updatedAt", "source"],
  })
  @ApiQuery({
    name: "sortOrder",
    required: false,
    enum: ["asc", "desc"],
  })
  @ApiOkResponse({ type: ContactListResponseDto })
  list(
    @CurrentUser() user: JwtUserPayload,
    @Query() query: ListContactsQueryDto,
  ) {
    return this.contacts.listPaginated(user.sub, query);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update a contact",
    description:
      "Updates ContactBook-managed fields and triggers provider write-back for Google/iCloud contacts when write scope is available.",
  })
  @ApiOkResponse({ type: ContactDetailDto })
  update(
    @CurrentUser() user: JwtUserPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contacts.updateContact(user.sub, id, dto);
  }

  @Put(":id/tags")
  @ApiOperation({ summary: "Replace tags on a contact" })
  @ApiOkResponse({ type: ContactDetailDto })
  setTags(
    @CurrentUser() user: JwtUserPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SetContactTagsDto,
  ) {
    return this.contacts.setContactTags(user.sub, id, dto.tagIds);
  }

  @Put(":id/groups")
  @ApiOperation({ summary: "Replace groups on a contact" })
  @ApiOkResponse({ type: ContactDetailDto })
  setGroups(
    @CurrentUser() user: JwtUserPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SetContactGroupsDto,
  ) {
    return this.contacts.setContactGroups(user.sub, id, dto.groupIds);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one contact" })
  @ApiOkResponse({ type: ContactDetailDto })
  get(
    @CurrentUser() user: JwtUserPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.contacts.get(user.sub, id);
  }
}
