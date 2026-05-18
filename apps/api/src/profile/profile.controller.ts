import { Body, Controller, Get, Patch, Put, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  ProfileMePatchDto,
  ProfileMePutDto,
} from "./dto/profile-me-upsert.dto";
import { ProfileMeResponseDto } from "./dto/profile-me-response.dto";
import { ProfileMeSerializerService } from "./profile-me.serializer";
import { ProfileMeUpsertService } from "./profile-me.upsert.service";

@ApiTags("Profile")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller({ path: "profile", version: "1" })
export class ProfileController {
  constructor(
    private readonly profileMe: ProfileMeSerializerService,
    private readonly profileMeUpsert: ProfileMeUpsertService,
  ) {}

  @Get("me")
  @ApiOperation({
    summary: "Current user profile (nested JSON for clients)",
    description:
      "Returns identity (User + IDENTITY groups), merged personal, work/business/social arrays, and financial rows.",
  })
  @ApiOkResponse({ type: ProfileMeResponseDto })
  getMe(@CurrentUser() user: JwtUserPayload) {
    return this.profileMe.build(user.sub);
  }

  @Patch("me")
  @ApiOperation({
    summary: "Partially update profile",
    description:
      "Only top-level sections present in the body are applied. Within each section, arrays are reconciled (items omitted are removed). Omit `groupId` to create a new work/business/social group; omit `fieldId` to create a new financial row.",
  })
  @ApiOkResponse({ type: ProfileMeResponseDto })
  patchMe(@CurrentUser() user: JwtUserPayload, @Body() dto: ProfileMePatchDto) {
    return this.profileMeUpsert.patch(user.sub, dto);
  }

  @Put("me")
  @ApiOperation({
    summary: "Update profile sections (same reconcile rules as PATCH)",
    description:
      "Use after GET /profile/me with the full body for whole-form saves, or PATCH a single section for targeted edits.",
  })
  @ApiOkResponse({ type: ProfileMeResponseDto })
  putMe(@CurrentUser() user: JwtUserPayload, @Body() dto: ProfileMePutDto) {
    return this.profileMeUpsert.put(user.sub, dto);
  }
}
