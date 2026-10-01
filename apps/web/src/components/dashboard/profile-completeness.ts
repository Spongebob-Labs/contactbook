import type { FieldCategory, FieldGroup, FieldType, ProfileField, User } from "@/types/domain";

/**
 * Profile completeness — the eight details a card is usually built from, and which of them the
 * owner has filled in.
 *
 * ## Why a fixed key set, and why it lives in one constant
 *
 * A profile has no maximum size, so "62% complete" measured against *all possible fields* is a
 * number nobody could defend. What the dashboard can defend is a short, named list: the details
 * a recipient expects to find on a contact card. The denominator is this list, and it is
 * spelled out here so the figure on screen is always "n of these eight", never a guess.
 *
 * `PROFILE_KEY_ITEMS` is exported, and is the only definition of that list. The profile page's
 * suggested fields should read it too, so the dashboard never asks for a detail the profile
 * page does not offer (and vice versa). Order matters: it is the order the dashboard suggests
 * missing items in, most useful first.
 *
 * ## ⚠ Values are never read for display
 *
 * Every predicate checks presence only. Nothing here returns, logs or stringifies a
 * `ProfileField.value` (CLAUDE.md, non-negotiable 5).
 */

/** What a predicate is given: the same three shapes `fetchProfileData` returns. */
export interface ProfileSnapshot {
  user: Pick<User, "phone" | "email" | "avatarUrl">;
  groups: readonly Pick<FieldGroup, "id" | "category">[];
  fields: readonly Pick<ProfileField, "groupId" | "type" | "value">[];
}

export type ProfileKeyId =
  | "photo"
  | "mobile"
  | "email"
  | "jobTitle"
  | "company"
  | "address"
  | "birthday"
  | "social";

export interface ProfileKeyItem {
  id: ProfileKeyId;
  /** The noun, for anything that lists the set. */
  label: string;
  /** The call to action shown when the item is missing. */
  action: string;
  /** Where the owner fills it in. */
  href: string;
  /** Presence only. Never returns or reads out a value. */
  isDone: (profile: ProfileSnapshot) => boolean;
}

const hasText = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

function categoryOf(profile: ProfileSnapshot, groupId: string): FieldCategory | undefined {
  return profile.groups.find((group) => group.id === groupId)?.category;
}

/** At least one non-empty field of `type`, optionally restricted to some categories. */
function hasField(
  profile: ProfileSnapshot,
  type: FieldType,
  categories?: readonly FieldCategory[],
): boolean {
  return profile.fields.some((field) => {
    if (field.type !== type || !hasText(field.value)) return false;
    if (categories === undefined) return true;
    const category = categoryOf(profile, field.groupId);
    return category !== undefined && categories.includes(category);
  });
}

const PROFILE_HREF = "/profile";

export const PROFILE_KEY_ITEMS: readonly ProfileKeyItem[] = [
  {
    id: "photo",
    label: "Photo",
    action: "Add a photo",
    href: PROFILE_HREF,
    isDone: (p) => hasText(p.user.avatarUrl) || hasField(p, "PHOTO"),
  },
  {
    id: "mobile",
    label: "Mobile",
    action: "Add your mobile",
    href: PROFILE_HREF,
    /* The sign-in number is verified, so this is nearly always done. A PHONE field counts too. */
    isDone: (p) => hasText(p.user.phone) || hasField(p, "PHONE"),
  },
  {
    id: "email",
    label: "Email",
    action: "Add your email",
    href: PROFILE_HREF,
    isDone: (p) => hasText(p.user.email) || hasField(p, "EMAIL"),
  },
  {
    id: "jobTitle",
    label: "Job title",
    action: "Add your job title",
    href: PROFILE_HREF,
    isDone: (p) => hasField(p, "JOB_TITLE"),
  },
  {
    id: "company",
    label: "Company",
    action: "Add your company",
    href: PROFILE_HREF,
    isDone: (p) => hasField(p, "COMPANY"),
  },
  {
    id: "address",
    label: "Home or work address",
    action: "Add an address",
    href: PROFILE_HREF,
    /* Home or work. A registered office (BUSINESS) is a company's address, not the owner's. */
    isDone: (p) => hasField(p, "ADDRESS", ["IDENTITY", "PERSONAL", "WORK"]),
  },
  {
    id: "birthday",
    label: "Date of birth",
    action: "Add your birthday",
    href: PROFILE_HREF,
    /* A DATE elsewhere (an anniversary under CUSTOM, say) is not the owner's birthday. */
    isDone: (p) => hasField(p, "DATE", ["IDENTITY", "PERSONAL"]),
  },
  {
    id: "social",
    label: "Social link",
    action: "Add a social link",
    href: PROFILE_HREF,
    isDone: (p) => hasField(p, "SOCIAL_LINK"),
  },
];

export interface ProfileCompleteness {
  done: number;
  total: number;
  /** Missing items, in `PROFILE_KEY_ITEMS` order. */
  missing: readonly ProfileKeyItem[];
}

export function profileCompleteness(
  profile: ProfileSnapshot,
  items: readonly ProfileKeyItem[] = PROFILE_KEY_ITEMS,
): ProfileCompleteness {
  const missing = items.filter((item) => !item.isDone(profile));
  return { done: items.length - missing.length, total: items.length, missing };
}
