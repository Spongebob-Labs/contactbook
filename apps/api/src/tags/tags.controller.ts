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
import { CreateTagDto, TagResponseDto, UpdateTagDto } from "./dto/tag.dto";
import { TagsService } from "./tags.service";
import { ApiExceptionFilter } from "../common/filters/api-exception.filter";

function toTagDto(tag: { id: string; name: string }): TagResponseDto {
  return { id: tag.id, name: tag.name };
}

@ApiTags("Contacts / Tags")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller({ path: "contacts/tags", version: "1" })
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @ApiOperation({ summary: "List tags for current user" })
  @ApiOkResponse({ type: [TagResponseDto] })
  async list(@CurrentUser() user: JwtUserPayload) {
    const rows = await this.tags.list(user.sub);
    return rows.map(toTagDto);
  }

  @Post()
  @ApiOperation({ summary: "Create a tag" })
  @ApiCreatedResponse({ type: TagResponseDto })
  async create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateTagDto) {
    return toTagDto(await this.tags.create(user.sub, dto));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Rename a tag" })
  @ApiOkResponse({ type: TagResponseDto })
  async update(
    @CurrentUser() user: JwtUserPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return toTagDto(await this.tags.update(user.sub, id, dto));
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a tag" })
  @ApiOkResponse({ description: "Tag deleted" })
  async remove(
    @CurrentUser() user: JwtUserPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.tags.remove(user.sub, id);
    return { ok: true };
  }
}
