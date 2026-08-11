import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ApiExceptionFilter } from "../common/filters/api-exception.filter";
import { WhatsappTemplateService } from "./whatsapp-template.service";
import { ListWhatsappTemplatesQueryDto } from "./dto/list-whatsapp-templates-query.dto";
import { CreateWhatsappTemplateDto } from "./dto/create-whatsapp-template.dto";
import { UpdateWhatsappTemplateDto } from "./dto/update-whatsapp-template.dto";
import { WhatsappTemplateResponseDto } from "./dto/whatsapp-template-response.dto";

@ApiTags("Card Share")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller({ path: "whatsapp-templates", version: "1" })
export class WhatsappTemplateController {
  constructor(private readonly templates: WhatsappTemplateService) {}

  @Get()
  @ApiOperation({
    summary: "List all WhatsApp templates",
    description:
      "Returns all templates (active and inactive). Filter by useCase. " +
      "Approval status is NOT fetched from Twilio on list — use GET /:key for that.",
  })
  @ApiOkResponse({ type: [WhatsappTemplateResponseDto] })
  list(@Query() query: ListWhatsappTemplatesQueryDto) {
    return this.templates.listAll(query.useCase);
  }

  @Get(":key")
  @ApiOperation({
    summary: "Get a single template, reconciled against Twilio",
    description:
      "Runs a live sync against the Twilio Content API before returning: content drift " +
      "is repaired from Twilio, approval status is mirrored, and templates deleted on " +
      "Twilio are flagged MISSING_ON_TWILIO and deactivated.",
  })
  @ApiOkResponse({ type: WhatsappTemplateResponseDto })
  getOne(@Param("key") key: string) {
    return this.templates.getOne(key);
  }

  @Post(":key/sync")
  @ApiOperation({
    summary: "Force an immediate DB<->Twilio reconciliation for a template",
    description:
      "Same reconciliation the 10-minute cron performs, on demand. Use after editing " +
      "or approving a template in the Twilio Console to pick up the change immediately.",
  })
  @ApiOkResponse({ type: WhatsappTemplateResponseDto })
  syncNow(@Param("key") key: string) {
    return this.templates.syncNow(key);
  }

  @Post()
  @ApiOperation({
    summary:
      "Create a new WhatsApp template on Twilio and register it in the DB",
    description:
      "Creates a Content Template (body + Save Contact URL button, optional image header), " +
      "submits it for WhatsApp approval, and saves the row. The template stays out of the " +
      "user-facing picker and is blocked at send time until Meta approves it.",
  })
  @ApiCreatedResponse({ type: WhatsappTemplateResponseDto })
  create(@Body() dto: CreateWhatsappTemplateDto) {
    return this.templates.create(dto);
  }

  @Patch(":key")
  @ApiOperation({
    summary: "Update a template",
    description:
      "isActive changes are a DB-only update. Content changes (body, buttonTitle, " +
      "headerImageUrl) create a new Twilio Content Template, submit it for re-approval, " +
      "and swap the contentSid; sends are blocked until the new content is approved.",
  })
  @ApiOkResponse({ type: WhatsappTemplateResponseDto })
  update(@Param("key") key: string, @Body() dto: UpdateWhatsappTemplateDto) {
    return this.templates.update(key, dto);
  }

  @Delete(":key")
  @ApiOperation({
    summary: "Delete a template from Twilio and deactivate it in the DB",
    description:
      "Permanently deletes the Content Template from Twilio (irreversible) and sets " +
      "isActive: false in the DB. Blocked if it is the only active template for its use case.",
  })
  @ApiOkResponse({ schema: { properties: { ok: { type: "boolean" } } } })
  remove(@Param("key") key: string) {
    return this.templates.delete(key);
  }
}
