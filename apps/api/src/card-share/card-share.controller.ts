import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ApiExceptionFilter } from "../common/filters/api-exception.filter";
import { CardShareService } from "./card-share.service";
import { WhatsappTemplateService } from "./whatsapp-template.service";
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

  // Static segment — declared before the :cardId routes so it never matches as an id.
  @Get("share-templates")
  @ApiOperation({
    summary: "List templates available in the share picker",
    description:
      "Active, WhatsApp-approved templates verified in sync with Twilio. The body/button " +
      "content mirrors Twilio exactly, so a preview rendered from it matches the sent " +
      "message character-for-character. Empty when no template is currently sendable.",
  })
  @ApiOkResponse({ type: [ShareTemplateResponseDto] })
  async listShareTemplates(): Promise<ShareTemplateResponseDto[]> {
    const templates = await this.templates.listForPicker();
    return templates.map((t) => ({
      key: t.key,
      locale: t.locale,
      body: t.bodyPreview,
      buttonTitle: t.buttonTitle,
      headerImageUrl: t.headerImageUrl,
      syncedAt: t.syncedAt,
    }));
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
