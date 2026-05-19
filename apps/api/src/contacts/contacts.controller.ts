import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { ContactSource } from "@prisma/client";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ContactsSyncService } from "./contacts-sync.service";
import { ContactsService } from "./contacts.service";
import { ContactImportSummaryDto } from "./dto/contact-import-summary.dto";
import { ContactDetailDto } from "./dto/contact-response.dto";
import { ContactSyncResponseDto } from "./dto/contact-sync-response.dto";

@ApiTags("Contacts")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller({ path: "contacts", version: "1" })
export class ContactsController {
  constructor(
    private readonly contacts: ContactsService,
    private readonly contactsSync: ContactsSyncService,
  ) {}

  @Get("sync")
  @ApiOperation({
    summary: "Sync contacts from a provider",
    description:
      "Runs incremental provider sync when a sync token exists (Google). On an expired token, falls back to the same full import as GET /contacts/import. iCloud is not implemented yet.",
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

  @Get("import")
  @ApiOperation({
    summary: "Import contacts from a provider",
    description:
      "Runs a full provider import for the given source (Google never uses a stored sync token), then returns counts and last sync metadata.",
  })
  @ApiQuery({
    name: "source",
    enum: [ContactSource.GOOGLE, ContactSource.ICLOUD],
  })
  @ApiOkResponse({ type: ContactImportSummaryDto })
  async import(
    @CurrentUser() user: JwtUserPayload,
    @Query("source", new ParseEnumPipe(ContactSource)) source: ContactSource,
  ) {
    await this.contactsSync.import(user.sub, source);
    return this.contacts.getImportSummary(user.sub);
  }

  @Get()
  @ApiOperation({
    summary: "List contacts",
    description:
      "Normalized contact records (phones, emails, organizations, addresses, urls) for the current user.",
  })
  @ApiQuery({ name: "source", enum: ContactSource, required: false })
  @ApiOkResponse({ type: [ContactDetailDto] })
  list(
    @CurrentUser() user: JwtUserPayload,
    @Query("source", new ParseEnumPipe(ContactSource, { optional: true }))
    source?: ContactSource,
  ) {
    return this.contacts.list(user.sub, source);
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
