import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ConnectionService } from "./connection.service";
import { CreateConnectionRequestDto } from "./dto/create-connection-request.dto";
import {
  ConnectionInviteResponseDto,
  ConnectionResponseDto,
} from "./dto/create-connection-response.dto";

function toConnectionDto(
  connection: Awaited<
    ReturnType<ConnectionService["listForUser"]>
  >[number],
): ConnectionResponseDto {
  return {
    type: "connection",
    id: connection.id,
    status: connection.status,
    requesterId: connection.requesterId,
    receiverId: connection.receiverId,
    requesterSharedCardId: connection.requesterSharedCardId,
    receiverSharedCardId: connection.receiverSharedCardId,
    hasSharedBack: connection.hasSharedBack,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

@ApiTags("Connections")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller({ path: "connections", version: "1" })
export class ConnectionController {
  constructor(private readonly connections: ConnectionService) {}

  @Get()
  @ApiOperation({ summary: "List connections for current user" })
  @ApiOkResponse({ type: [ConnectionResponseDto] })
  async list(@CurrentUser() user: JwtUserPayload) {
    const rows = await this.connections.listForUser(user.sub);
    return rows.map(toConnectionDto);
  }

  @Post("requests")
  @ApiOperation({
    summary: "Send a connection request (WhatsApp to recipient)",
  })
  @ApiCreatedResponse({
    description: "Connection created or invite sent",
    schema: {
      oneOf: [
        { $ref: "#/components/schemas/ConnectionResponseDto" },
        { $ref: "#/components/schemas/ConnectionInviteResponseDto" },
      ],
    },
  })
  async create(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: CreateConnectionRequestDto,
  ): Promise<ConnectionResponseDto | ConnectionInviteResponseDto> {
    const result = await this.connections.createRequest(user.sub, dto);
    if (result.type === "connection") {
      return toConnectionDto(result.connection);
    }
    return {
      type: "invite",
      id: result.invite.id,
      recipientKind: result.invite.recipientKind,
      recipientContactId: result.invite.recipientContactId,
      recipientCountryCode: result.invite.recipientCountryCode,
      recipientPhone: result.invite.recipientPhone,
      status: result.invite.status,
      expiresAt: result.invite.expiresAt,
      createdAt: result.invite.createdAt,
    };
  }

  @Post(":id/accept")
  @ApiOperation({
    summary: "Accept pending connection (WhatsApp only)",
  })
  @ApiConflictResponse({
    description: "Completion must happen via WhatsApp",
  })
  accept() {
    return this.connections.assertWhatsAppOnlyCompletion();
  }

  @Post(":id/decline")
  @ApiOperation({ summary: "Decline pending connection (WhatsApp only)" })
  @ApiConflictResponse({
    description: "Completion must happen via WhatsApp",
  })
  decline() {
    return this.connections.assertWhatsAppOnlyCompletion();
  }

  @Post(":id/share-back")
  @ApiOperation({
    summary: "Share back (WhatsApp only)",
  })
  @ApiConflictResponse({
    description: "Completion must happen via WhatsApp",
  })
  shareBack() {
    return this.connections.assertWhatsAppOnlyCompletion();
  }
}
