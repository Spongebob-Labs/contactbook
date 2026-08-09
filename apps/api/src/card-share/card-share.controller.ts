import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ApiExceptionFilter } from "../common/filters/api-exception.filter";
import { CardShareService } from "./card-share.service";
import { WhatsappTemplateService } from "./whatsapp-template.service";
import {
  SHARE_TEMPLATE_BUTTON_TITLE,
  SHARE_TEMPLATE_VARIANTS,
} from "./share-template-variants";
import { CreateShareTemplateDto } from "./dto/create-share-template.dto";
import { ShareCardDto } from "./dto/share-card.dto";
import { ShareTemplateResponseDto } from "./dto/share-template-response.dto";
import { GenerateVcardDto } from "./dto/generate-vcard.dto";
import { VcardAssetResponseDto } from "./dto/vcard-asset-response.dto";
import { ListCardSharesQueryDto } from "./dto/list-card-shares-query.dto";
import { CardShareBatchResponseDto } from "./dto/card-share-batch-response.dto";
import { CardShareBatchListResponseDto } from "./dto/card-share-batch-list-response.dto";

@ApiTags("Card Share")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller({ path: "cards", version: "1" })
export class CardShareController {
  constructor(
    private readonly cardShare: CardShareService,
    private readonly templates: WhatsappTemplateService,
  ) {}

  // Static segments — declared before the :cardId routes so they never match as ids.
  @Get("share-templates")
  @ApiOperation({
    summary: "List templates available in the share picker",
    description:
      "Active, WhatsApp-approved templates verified in sync with Twilio: global ones " +
      "plus the caller's own creations. Pass includePending=true to also return the " +
      "caller's own templates that are still awaiting Meta approval (not sendable yet).",
  })
  @ApiQuery({
    name: "includePending",
    required: false,
    type: Boolean,
    description: "Include the caller's own PENDING/REJECTED templates in the response.",
  })
  @ApiOkResponse({ type: [ShareTemplateResponseDto] })
  async listShareTemplates(
    @CurrentUser() user: JwtUserPayload,
    @Query("includePending", new ParseBoolPipe({ optional: true }))
    includePending?: boolean,
  ): Promise<ShareTemplateResponseDto[]> {
    const templates = await this.templates.listForPicker(
      undefined,
      user.sub,
      includePending,
    );
    return templates.map((t) => ({
      key: t.key,
      locale: t.locale,
      body: t.bodyPreview,
      buttonTitle: t.buttonTitle,
      headerImageUrl: t.headerImageUrl,
      syncedAt: t.syncedAt,
      approvalStatus: t.approvalStatus,
    }));
  }

  @Get("share-templates/variants")
  @ApiOperation({
    summary: "List the body copy variants available for user-created templates",
    description:
      "Users pick one of these fixed bodies (plus an optional header image) when " +
      "creating their own template — freeform body text is not allowed.",
  })
  @ApiOkResponse({
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", example: "classic" },
          label: { type: "string", example: "Classic" },
          body: { type: "string" },
          buttonTitle: { type: "string", example: "Get Contact" },
        },
      },
    },
  })
  listShareTemplateVariants() {
    return SHARE_TEMPLATE_VARIANTS.map((v) => ({
      ...v,
      buttonTitle: SHARE_TEMPLATE_BUTTON_TITLE,
    }));
  }

  @Post("share-templates")
  @UseInterceptors(FileInterceptor("image"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary:
      "Create your own share template (body variant + optional header image)",
    description:
      "Creates the template on Twilio (whatsapp/card with a Get Contact quick-reply " +
      "button when an image is attached, text-only otherwise), submits it for WhatsApp " +
      "approval, and registers it 1:1 in the registry owned by you. It appears in your " +
      "picker automatically once Meta approves. Limited to 3 templates per user.",
  })
  @ApiCreatedResponse({ type: ShareTemplateResponseDto })
  async createShareTemplate(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: CreateShareTemplateDto,
    @UploadedFile() image: Express.Multer.File | undefined,
  ): Promise<ShareTemplateResponseDto> {
    const created = await this.templates.createUserTemplate(
      user.sub,
      dto.variant,
      image
        ? {
            buffer: image.buffer,
            mimeType: image.mimetype,
            sizeBytes: image.size,
          }
        : undefined,
    );
    return {
      key: created.key,
      locale: created.locale,
      body: created.bodyPreview,
      buttonTitle: created.buttonTitle,
      headerImageUrl: created.headerImageUrl,
      syncedAt: created.syncedAt,
      approvalStatus: created.approvalStatus,
    };
  }

  @Post(":cardId/vcard")
  @ApiOperation({
    summary:
      "Generate (or retrieve a cached) VCF asset for a card with optional field selection",
    description:
      "Produces a content-addressed VCF in GCS. Pass `fieldTypes` to limit which fields are included " +
      "(e.g. phone-only). The same field selection on the same card reuses the existing upload.",
  })
  @ApiCreatedResponse({
    description: "VCF asset details including GCS object key and public URL",
    type: VcardAssetResponseDto,
  })
  generateVcard(
    @CurrentUser() user: JwtUserPayload,
    @Param("cardId", ParseUUIDPipe) cardId: string,
    @Body() dto: GenerateVcardDto,
  ) {
    return this.cardShare.generateVcard(user.sub, cardId, dto);
  }

  @Post(":cardId/share")
  @ApiOperation({
    summary:
      "Share a contact card to one or more phone numbers over WhatsApp (async dispatch)",
  })
  @ApiCreatedResponse({
    description: "Share batch created; recipients start out PENDING dispatch",
    type: CardShareBatchResponseDto,
  })
  createShare(
    @CurrentUser() user: JwtUserPayload,
    @Param("cardId", ParseUUIDPipe) cardId: string,
    @Body() dto: ShareCardDto,
  ) {
    return this.cardShare.createBatch(user.sub, cardId, dto);
  }

  @Get(":cardId/shares")
  @ApiOperation({ summary: "List WhatsApp share batches for a card" })
  @ApiOkResponse({
    description: "Paginated share batch history",
    type: CardShareBatchListResponseDto,
  })
  listShares(
    @CurrentUser() user: JwtUserPayload,
    @Param("cardId", ParseUUIDPipe) cardId: string,
    @Query() query: ListCardSharesQueryDto,
  ) {
    return this.cardShare.listBatchesForCard(user.sub, cardId, query);
  }
}
