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
  ApiNoContentResponse,
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
    summary: "Get a single template with live Twilio approval status",
    description:
      "Fetches the template from DB and enriches it with the current WhatsApp " +
      "approval status from the Twilio Content API.",
  })
  @ApiOkResponse({ type: WhatsappTemplateResponseDto })
  getOne(@Param("key") key: string) {
    return this.templates.getOne(key);
  }

  @Post()
  @ApiOperation({
    summary: "Create a new WhatsApp template on Twilio and register it in the DB",
    description:
      "Creates a twilio/call-to-action Content Template (body + Save Contact URL button), " +
      "submits it for WhatsApp approval, and saves the row with isActive: false. " +
      "Once Twilio shows approvalStatus: approved, activate it via PATCH /:key { isActive: true }.",
  })
  @ApiCreatedResponse({ type: WhatsappTemplateResponseDto })
  create(@Body() dto: CreateWhatsappTemplateDto) {
    return this.templates.create(dto);
  }

  @Patch(":key")
  @ApiOperation({
    summary: "Update a template",
    description:
      "Metadata-only changes (isDefault, isActive): DB update only. " +
      "If body or buttonTitle is provided, a new Twilio Content Template is created, " +
      "submitted for re-approval, contentSid is swapped, and isActive is reset to false.",
  })
  @ApiOkResponse({ type: WhatsappTemplateResponseDto })
  update(
    @Param("key") key: string,
    @Body() dto: UpdateWhatsappTemplateDto,
  ) {
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
