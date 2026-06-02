import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UseFilters,
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
import {
  ContactGroupResponseDto,
  CreateContactGroupDto,
  UpdateContactGroupDto,
} from "./dto/group.dto";
import { GroupsService } from "./groups.service";
import { ApiExceptionFilter } from "../common/filters/api-exception.filter";

function toGroupDto(group: {
  id: string;
  name: string;
  source?: ContactGroupResponseDto["source"];
  externalId?: string | null;
}): ContactGroupResponseDto {
  return {
    id: group.id,
    name: group.name,
    source: group.source ?? null,
    externalId: group.externalId ?? null,
  };
}

@ApiTags("Contacts / Groups")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller({ path: "contacts/groups", version: "1" })
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  @ApiOperation({ summary: "List contact groups for current user" })
  @ApiOkResponse({ type: [ContactGroupResponseDto] })
  async list(@CurrentUser() user: JwtUserPayload) {
    const rows = await this.groups.list(user.sub);
    return rows.map(toGroupDto);
  }

  @Post()
  @ApiOperation({ summary: "Create a contact group" })
  @ApiCreatedResponse({ type: ContactGroupResponseDto })
  async create(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: CreateContactGroupDto,
  ) {
    return toGroupDto(await this.groups.create(user.sub, dto));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Rename a user-created group" })
  @ApiOkResponse({ type: ContactGroupResponseDto })
  async update(
    @CurrentUser() user: JwtUserPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactGroupDto,
  ) {
    return toGroupDto(await this.groups.update(user.sub, id, dto));
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a user-created group" })
  @ApiOkResponse({ description: "Group deleted" })
  async remove(
    @CurrentUser() user: JwtUserPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.groups.remove(user.sub, id);
    return { ok: true };
  }
}
