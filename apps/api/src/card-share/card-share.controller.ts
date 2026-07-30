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
import { ShareCardDto } from "./dto/share-card.dto";
import { ListCardSharesQueryDto } from "./dto/list-card-shares-query.dto";
import { CardShareBatchResponseDto } from "./dto/card-share-batch-response.dto";
import { CardShareBatchListResponseDto } from "./dto/card-share-batch-list-response.dto";

@ApiTags("Card Share")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller({ path: "cards", version: "1" })
export class CardShareController {
  constructor(private readonly cardShare: CardShareService) {}

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
