import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ProfileDeleteGroupDto } from "./dto/profile-delete-group.dto";
import { ProfileMeOnboardingDto } from "./dto/profile-me-onboarding.dto";
import { ProfileMePatchDto } from "./dto/profile-me-upsert.dto";
import {
  ProfileMeResponseDto,
  ProfileOnboardingResponseDto,
} from "./dto/profile-me-response.dto";
import { ProfileMeSerializerService } from "./profile-me.serializer";
import { ProfileMeUpsertService } from "./profile-me.upsert.service";
import type { ProfileMeResponse } from "./profile-me.types";

@ApiTags("Profile")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller({ path: "profile", version: "1" })
export class ProfileController {
  constructor(
    private readonly profileMe: ProfileMeSerializerService,
    private readonly profileMeUpsert: ProfileMeUpsertService,
  ) {}

  @Post("onboarding")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "First-time profile setup after registration",
    description:
      "Requires identity (firstName, lastName, primaryEmail, primaryPhone; updates the user record; profilePhoto optional). " +
      "Request body uses the same flattened shape as GET /profile/me (work.companyName, business.businessName, socials.skype, financial.isSensitive, etc.). " +
      "Do not send profileOnboardingCompletedAt — the server sets it. Omit groupId/fieldId on first-time setup. Returns 409 if onboarding already completed.",
  })
  @ApiBody({
    type: ProfileMeOnboardingDto,
    examples: {
      firstTime: {
        summary: "First-time onboarding (no groupId/fieldId)",
        value: {
          identity: {
            firstName: "Jane",
            lastName: "Doe",
            primaryPhone: "+12025551234",
            primaryEmail: "jane@example.com",
            profilePhoto: null,
          },
          personal: {
            tag: "Primary Personal",
            mobile: "+12025551234",
          },
        },
      },
      fullProfile: {
        summary: "Flattened sections (matches GET /profile/me write shape)",
        value: {
          identity: {
            firstName: "Jane",
            lastName: "Doe",
            primaryPhone: "+12025551234",
            primaryEmail: "jane@example.com",
            profilePhoto: null,
          },
          personal: {
            tag: "Primary Personal",
            mobile: "+12025551234",
            postalAddress: {
              street: "1 Main St",
              city: "Springfield",
              state: "IL",
              pincode: "62701",
              country: "USA",
            },
          },
          work: [
            {
              tag: "Acme Corp",
              companyName: "Acme Corp",
              workTitle: "Engineer",
            },
          ],
          financial: {
            bankAccounts: [
              {
                tag: "Primary",
                bankName: "Example Bank",
                accountHolder: "Jane Doe",
                accountNumber: "123456789",
                currency: "USD",
                isSensitive: true,
              },
            ],
          },
        },
      },
    },
  })
  @ApiCreatedResponse({ type: ProfileOnboardingResponseDto })
  async completeOnboarding(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: ProfileMeOnboardingDto,
  ): Promise<Omit<ProfileMeResponse, "profileOnboardingCompletedAt">> {
    const result = await this.profileMeUpsert.completeOnboarding(user.sub, dto);
    const rest = { ...result } as Partial<ProfileMeResponse>;
    delete rest.profileOnboardingCompletedAt;
    return rest as Omit<ProfileMeResponse, "profileOnboardingCompletedAt">;
  }

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
      "Only top-level sections present in the body are applied. Same flattened field names as GET /profile/me. Empty shells are ignored. " +
      "Use null on personal fields to clear them; identity core fields cannot be null. Remove work/business/social/financial groups via DELETE /profile/me/groups.",
  })
  @ApiBody({ type: ProfileMePatchDto })
  @ApiOkResponse({ type: ProfileMeResponseDto })
  patchMe(@CurrentUser() user: JwtUserPayload, @Body() dto: ProfileMePatchDto) {
    return this.profileMeUpsert.patch(user.sub, dto);
  }

  @Delete("me/groups")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Delete a work, business, social, or financial field group",
    description:
      "Deletes the entire group and its fields. Use PATCH with null to clear personal or identity profile fields.",
  })
  @ApiOkResponse({ type: ProfileMeResponseDto })
  deleteGroup(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: ProfileDeleteGroupDto,
  ) {
    return this.profileMeUpsert.deleteGroup(user.sub, dto);
  }
}
