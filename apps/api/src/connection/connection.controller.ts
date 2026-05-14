import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ConnectionService } from "./connection.service";
import { CreateConnectionRequestDto } from "./dto/create-connection-request.dto";

@ApiTags("Connections")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller({ path: "connections", version: "1" })
export class ConnectionController {
  constructor(private readonly connections: ConnectionService) {}

  @Get()
  @ApiOperation({ summary: "List connections for current user" })
  list(@CurrentUser() user: JwtUserPayload) {
    return this.connections.listForUser(user.sub);
  }

  @Post("requests")
  @ApiOperation({
    summary: "Send a connection request (WhatsApp to recipient)",
  })
  create(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: CreateConnectionRequestDto,
  ) {
    return this.connections.createRequest(user.sub, dto);
  }

  @Post(":id/accept")
  @ApiOperation({
    summary: "Accept pending connection (API path; WhatsApp also supported)",
  })
  accept(
    @CurrentUser() user: JwtUserPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.connections.accept(id, user.sub);
  }

  @Post(":id/decline")
  @ApiOperation({ summary: "Decline pending connection" })
  decline(
    @CurrentUser() user: JwtUserPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.connections.decline(id, user.sub);
  }

  @Post(":id/share-back")
  @ApiOperation({ summary: "Mark that the receiver has shared back (hasSharedBack)" })
  shareBack(
    @CurrentUser() user: JwtUserPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.connections.shareBack(id, user.sub);
  }
}
