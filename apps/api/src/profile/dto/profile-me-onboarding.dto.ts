import { ApiPropertyOptional } from "@nestjs/swagger";
import { ProfileMePatchDto } from "./profile-me-upsert.dto";

/**
 * First-time profile setup after registration (`POST /v1/profile/onboarding`).
 * Same nested shape as GET/PATCH `/profile/me`.
 *
 * - Core identity (`firstName`, `lastName`, `primaryEmail`, `primaryPhone`) is set at
 *   registration; only `identity.profilePhoto` is applied here.
 * - Omit `groupId` / `fieldId` on create — the server assigns them.
 * - At least one of `personal`, `work`, `business`, `socials`, or `financial` is required
 *   (enforced in `ProfileMeUpsertService.completeOnboarding`).
 */
export class ProfileMeOnboardingDto extends ProfileMePatchDto {
  @ApiPropertyOptional({
    description:
      "Optional. Only `profilePhoto` is stored; other identity fields must match the user from registration if sent.",
  })
  declare identity?: ProfileMePatchDto["identity"];
}
