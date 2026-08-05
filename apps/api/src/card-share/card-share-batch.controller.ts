import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ApiExceptionFilter } from "../common/filters/api-exception.filter";
import { CardShareService } from "./card-share.service";
import { CardShareBatchResponseDto } from "./dto/card-share-batch-response.dto";
import { CardShareRecipientResponseDto } from "./dto/card-share-recipient-response.dto";

@ApiTags("Card Share")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller({ path: "card-shares", version: "1" })
export class CardShareBatchController {
  constructor(private readonly cardShare: CardShareService) {}

  @Get(":batchId")
  @ApiOperation({ summary: "Get a share batch and its recipient statuses" })
  @ApiOkResponse({
    description: "Share batch detail",
    type: CardShareBatchResponseDto,
  })
  getBatch(
    @CurrentUser() user: JwtUserPayload,
    @Param("batchId", ParseUUIDPipe) batchId: string,
  ) {
    return this.cardShare.getBatch(user.sub, batchId);
  }

  @Post(":batchId/recipients/:recipientId/resend")
  @ApiOperation({
    summary: "Retry a failed recipient in an existing share batch",
  })
  @ApiOkResponse({
    description: "Recipient reset to PENDING for the next dispatch sweep",
    type: CardShareRecipientResponseDto,
  })
  resendRecipient(
    @CurrentUser() user: JwtUserPayload,
    @Param("batchId", ParseUUIDPipe) batchId: string,
    @Param("recipientId", ParseUUIDPipe) recipientId: string,
  ) {
    return this.cardShare.resendRecipient(user.sub, batchId, recipientId);
  }
}
