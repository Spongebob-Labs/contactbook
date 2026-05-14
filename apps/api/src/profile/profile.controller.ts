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
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateFieldGroupDto } from "./dto/create-field-group.dto";
import { CreateProfileFieldDto } from "./dto/create-profile-field.dto";
import { UpdateFieldGroupDto } from "./dto/update-field-group.dto";
import { UpdateProfileFieldDto } from "./dto/update-profile-field.dto";
import { ProfileMeSerializerService } from "./profile-me.serializer";
import { ProfileService } from "./profile.service";

@ApiTags("Profile")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller({ path: "profile", version: "1" })
export class ProfileController {
  constructor(
    private readonly profile: ProfileService,
    private readonly profileMe: ProfileMeSerializerService,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "Current user profile (grouped, frontend-optimized)" })
  getMe(@CurrentUser() user: JwtUserPayload) {
    return this.profileMe.build(user.sub);
  }

  @Get("field-groups")
  @ApiOperation({ summary: "List field groups" })
  listGroups(@CurrentUser() user: JwtUserPayload) {
    return this.profile.listFieldGroups(user.sub);
  }

  @Post("field-groups")
  @ApiOperation({ summary: "Create field group" })
  createGroup(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: CreateFieldGroupDto,
  ) {
    return this.profile.createFieldGroup(user.sub, dto);
  }

  @Get("field-groups/:groupId")
  @ApiOperation({ summary: "Get field group" })
  getGroup(
    @CurrentUser() user: JwtUserPayload,
    @Param("groupId", ParseUUIDPipe) groupId: string,
  ) {
    return this.profile.getFieldGroup(user.sub, groupId);
  }

  @Patch("field-groups/:groupId")
  @ApiOperation({ summary: "Update field group" })
  updateGroup(
    @CurrentUser() user: JwtUserPayload,
    @Param("groupId", ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateFieldGroupDto,
  ) {
    return this.profile.updateFieldGroup(user.sub, groupId, dto);
  }

  @Delete("field-groups/:groupId")
  @ApiOperation({ summary: "Delete field group and its fields" })
  async deleteGroup(
    @CurrentUser() user: JwtUserPayload,
    @Param("groupId", ParseUUIDPipe) groupId: string,
  ): Promise<{ ok: true }> {
    await this.profile.deleteFieldGroup(user.sub, groupId);
    return { ok: true };
  }

  @Post("field-groups/:groupId/fields")
  @ApiOperation({ summary: "Create profile field (uses transaction for extensions)" })
  createField(
    @CurrentUser() user: JwtUserPayload,
    @Param("groupId", ParseUUIDPipe) groupId: string,
    @Body() dto: CreateProfileFieldDto,
  ) {
    return this.profile.createField(user.sub, groupId, dto);
  }

  @Patch("fields/:fieldId")
  @ApiOperation({ summary: "Update profile field" })
  updateField(
    @CurrentUser() user: JwtUserPayload,
    @Param("fieldId", ParseUUIDPipe) fieldId: string,
    @Body() dto: UpdateProfileFieldDto,
  ) {
    return this.profile.updateField(user.sub, fieldId, dto);
  }

  @Delete("fields/:fieldId")
  @ApiOperation({ summary: "Delete profile field" })
  async deleteField(
    @CurrentUser() user: JwtUserPayload,
    @Param("fieldId", ParseUUIDPipe) fieldId: string,
  ): Promise<{ ok: true }> {
    await this.profile.deleteField(user.sub, fieldId);
    return { ok: true };
  }
}
