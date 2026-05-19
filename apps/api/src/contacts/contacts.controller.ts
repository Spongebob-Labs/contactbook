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
import { ContactsService } from "./contacts.service";
import { ContactImportSummaryDto } from "./dto/contact-import-summary.dto";
import { ContactDetailDto } from "./dto/contact-response.dto";

@ApiTags("Contacts")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller({ path: "contacts", version: "1" })
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get("import")
  @ApiOperation({
    summary: "Import summary by source",
    description:
      "Counts and last sync metadata per provider. Does not return individual contacts.",
  })
  @ApiOkResponse({ type: ContactImportSummaryDto })
  getImportSummary(@CurrentUser() user: JwtUserPayload) {
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
    @Query(
      "source",
      new ParseEnumPipe(ContactSource, { optional: true }),
    )
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
