/**
 * The one fixture `User` (spec §10.3), plus the no-avatar variant §11 E-19 is written
 * against.
 *
 * ⚠ THE FIXTURE TYPING PATTERN, used by every module in this directory:
 *
 *     export const thing: User = { … } as const satisfies User;
 *
 * The `satisfies` clause is what validates the literal — a typo'd `FieldType` or a missing
 * property is a **compile error, not a runtime surprise** (§10.3). The annotation in front
 * of it then widens what consumers see back to the domain type, deliberately: without it
 * every fixture exports a deep literal type, `field.detail` stops existing on the members
 * that happen to omit it, and every downstream track has to fight the fixtures instead of
 * reading them.
 */

import type { User } from "@/types/domain";

export const fixtureUser: User = {
  id: "user_prya",
  email: "priyanka@fernwood.example",
  phone: "+919820115577",
  countryCode: "+91",
  firstName: "Priyanka",
  lastName: "Raghunathan",
  isActive: true,
  onboardingCompleted: true,
  /** PLACEHOLDER-ART — procedurally generated, see the run-log. */
  avatarUrl: "/portraits/priyanka.png",
} as const satisfies User;

/**
 * §11 E-19: `avatarUrl` is `null` and no `PHOTO` field is mapped, so the avatar slot must
 * resolve to a monogram — never a broken-image icon, never a grey blob.
 */
export const fixtureUserNoAvatar: User = {
  ...fixtureUser,
  id: "user_prya_no_avatar",
  avatarUrl: null,
} as const satisfies User;
