import type { ApiFieldCategory } from "@/lib/api/schema";
import type { FieldCategory, FieldType, ProfileField } from "@/types/domain";

import { FIELD_CATALOGUE, type FieldOffer } from "./field-catalogue";

/**
 * THE SUGGESTED FIELDS — what `/profile` shows as blank rows so an owner can see what is worth
 * filling in, and the sections those rows live in.
 *
 * Client, 2026-09-28: *"Show blank fields by default so users understand what to fill in.
 * Personal: date of birth, home address, kids' names/birthdays. Work: company name, job title,
 * company logo, company address. Socials and Business as additional collapsible categories."*
 *
 * ## ⚠ A suggestion is never a stored field
 *
 * `POST /profile/fields` rejects an empty value (`@MinLength(1)`), so a blank row cannot exist
 * upstream. A suggestion is drawn client-side for as long as nothing in the profile answers it
 * ({@link FieldSuggestion.matches}); the owner's first non-empty save creates the real field and
 * the suggestion stops being drawn because a field now matches it.
 *
 * ## Why this is one exported table
 *
 * The workspace reads it today and the dashboard's "complete your profile" prompt is meant to
 * read the same list later. Two lists of "what a complete profile has" would disagree the first
 * time either was edited.
 */

export type ProfileSectionId = "personal" | "work" | "social" | "business" | "payment" | "other";

export interface FieldSuggestion {
  /** Stable id — the React key and `[data-suggestion]`. */
  id: string;
  /** The row's label, and the label the field is created with. */
  label: string;
  /** The muted line a blank row shows in place of a value. */
  prompt: string;
  type: FieldType;
  /** Where the created field is filed. */
  category: ApiFieldCategory;
  /** The input's placeholder once the row is opened. Reserved domains only. */
  placeholder: string;
  inputMode?: FieldOffer["inputMode"];
  /** True when an existing field already answers this suggestion, so no blank row is drawn. */
  matches: (field: ProfileField) => boolean;
}

export interface ProfileSection {
  id: ProfileSectionId;
  /** The section heading. */
  label: string;
  /** The categories whose fields are listed under this heading. */
  categories: readonly FieldCategory[];
  /** Where a field added from this section's "Add field" row is filed. */
  createCategory: ApiFieldCategory;
  /** Open on first render. Personal and Work are; the rest start collapsed. */
  defaultOpen: boolean;
  suggestions: readonly FieldSuggestion[];
  /** The "Add field" offers — this category's own entries in {@link FIELD_CATALOGUE}. */
  offers: readonly FieldOffer[];
  /** Personal carries the repeatable "Add a child" block. */
  children?: boolean;
  /** Work carries the company-logo row, which writes the selected card's logo. */
  companyLogo?: boolean;
}

/* ── children ──────────────────────────────────────────────────────────────────────────── */

/**
 * A child is a `FAMILY` group holding a `RELATION` named "Name" and a `DATE` named "Birthday".
 *
 * ## ⚠ This used to be a stopgap, and is not any more
 * Children were previously two loose `PERSONAL` fields — a `RELATION` labelled "Child" and a
 * `DATE` labelled "{name}'s birthday" — paired by label because *"there is no FAMILY group"*.
 * `FieldGroupCategory.FAMILY` exists now, so a child is a real group, and the pairing is the
 * group's own `fieldIds` rather than a regex over labels. The label constants below are kept
 * because the legacy pairing still has to read pre-existing loose children.
 */
export const CHILD_LABEL = "Child";

export function childBirthdayLabel(name: string): string {
  return `${name.trim()}'s birthday`;
}

export function isChildNameField(field: ProfileField): boolean {
  return field.type === "RELATION" && /^child\b/i.test(field.label.trim());
}

const BIRTHDAY_SUFFIX = /'s birthday$/i;

export interface ChildEntry {
  name: ProfileField;
  birthday: ProfileField | null;
}

/**
 * The owner's children, each with the birthday stored under their name, in profile order.
 *
 * Handles both shapes: a child in a real `FAMILY` group (their fields arrive already paired by
 * the group's own `fieldIds`) and a legacy loose child whose birthday matches by label. A
 * birthday whose name matches no child is left out and renders as an ordinary row.
 */
export function pairChildren(fields: readonly ProfileField[]): ChildEntry[] {
  const birthdays = fields.filter(
    (field) => field.type === "DATE" && BIRTHDAY_SUFFIX.test(field.label.trim()),
  );
  const taken = new Set<string>();
  return fields.filter(isChildNameField).map((name) => {
    const wanted = childBirthdayLabel(name.value).toLowerCase();
    const birthday =
      birthdays.find((b) => !taken.has(b.id) && b.label.trim().toLowerCase() === wanted) ?? null;
    if (birthday !== null) taken.add(birthday.id);
    return { name, birthday };
  });
}

/* ── the table ─────────────────────────────────────────────────────────────────────────── */

function offersFor(category: ApiFieldCategory): readonly FieldOffer[] {
  return FIELD_CATALOGUE.find((section) => section.category === category)?.offers ?? [];
}

function socialMatch(pattern: RegExp): (field: ProfileField) => boolean {
  return (field) =>
    field.type === "SOCIAL_LINK" && (pattern.test(field.label) || pattern.test(field.value));
}

/**
 * ⚠ **Order is the reading order.** Personal and Work first and open; Socials and Business after
 * them, collapsed; Payment and Other last, collapsed, with no suggestions of their own.
 *
 * IDENTITY fields (date of birth, an "About" line) are listed under Personal: that is where an
 * owner looks for them. The profile photo is not a row anywhere — the avatar at the top owns it.
 */
export const PROFILE_SECTIONS: readonly ProfileSection[] = [
  {
    id: "personal",
    label: "Personal",
    categories: ["IDENTITY", "PERSONAL", "FAMILY"],
    createCategory: "PERSONAL",
    defaultOpen: true,
    children: true,
    offers: offersFor("PERSONAL"),
    suggestions: [
      {
        id: "dob",
        label: "Date of birth",
        prompt: "Add date of birth",
        type: "DATE",
        category: "PERSONAL",
        placeholder: "1991-03-08",
        matches: (field) => field.type === "DATE" && !BIRTHDAY_SUFFIX.test(field.label.trim()),
      },
      {
        id: "home-address",
        label: "Home address",
        prompt: "Add home address",
        type: "ADDRESS",
        category: "PERSONAL",
        placeholder: "Flat 4, Anand Complex, Mumbai",
        matches: (field) => field.type === "ADDRESS",
      },
    ],
  },
  {
    id: "work",
    label: "Work",
    categories: ["WORK"],
    createCategory: "WORK",
    defaultOpen: true,
    companyLogo: true,
    offers: offersFor("WORK"),
    suggestions: [
      {
        id: "company",
        label: "Company name",
        prompt: "Add company name",
        type: "COMPANY",
        category: "WORK",
        placeholder: "Fernwood Studio",
        matches: (field) => field.type === "COMPANY",
      },
      {
        id: "job-title",
        label: "Job title",
        prompt: "Add job title",
        type: "JOB_TITLE",
        category: "WORK",
        placeholder: "Head of Partnerships",
        matches: (field) => field.type === "JOB_TITLE",
      },
      {
        id: "company-address",
        label: "Company address",
        prompt: "Add company address",
        type: "ADDRESS",
        category: "WORK",
        placeholder: "4th Floor, Raheja Titanium, Mumbai",
        matches: (field) => field.type === "ADDRESS",
      },
    ],
  },
  {
    id: "social",
    label: "Socials",
    categories: ["SOCIAL"],
    createCategory: "SOCIAL",
    defaultOpen: false,
    offers: offersFor("SOCIAL"),
    suggestions: [
      {
        id: "linkedin",
        label: "LinkedIn",
        prompt: "Add LinkedIn",
        type: "SOCIAL_LINK",
        category: "SOCIAL",
        placeholder: "linkedin.com/in/yourname",
        inputMode: "url",
        matches: socialMatch(/linkedin/i),
      },
      {
        id: "instagram",
        label: "Instagram",
        prompt: "Add Instagram",
        type: "SOCIAL_LINK",
        category: "SOCIAL",
        placeholder: "instagram.com/yourname",
        inputMode: "url",
        matches: socialMatch(/instagram/i),
      },
      {
        id: "x",
        label: "X",
        prompt: "Add X",
        type: "SOCIAL_LINK",
        category: "SOCIAL",
        placeholder: "x.com/yourname",
        inputMode: "url",
        matches: (field) =>
          field.type === "SOCIAL_LINK" &&
          (/^(x|twitter)$/i.test(field.label.trim()) ||
            /(^|\/\/|\.)(x|twitter)\.com/i.test(field.value)),
      },
    ],
  },
  {
    id: "business",
    label: "Business",
    categories: ["BUSINESS"],
    createCategory: "BUSINESS",
    defaultOpen: false,
    offers: offersFor("BUSINESS"),
    suggestions: [
      {
        id: "business-name",
        label: "Business name",
        prompt: "Add business name",
        type: "COMPANY",
        category: "BUSINESS",
        placeholder: "Fernwood Studio Pvt Ltd",
        matches: (field) => field.type === "COMPANY",
      },
      {
        id: "website",
        label: "Website",
        prompt: "Add website",
        type: "URL",
        category: "BUSINESS",
        placeholder: "company.example",
        inputMode: "url",
        matches: (field) => field.type === "URL",
      },
      {
        id: "business-address",
        label: "Business address",
        prompt: "Add business address",
        type: "ADDRESS",
        category: "BUSINESS",
        placeholder: "Unit 7, Kamala Mills, Mumbai",
        matches: (field) => field.type === "ADDRESS",
      },
    ],
  },
  {
    id: "payment",
    label: "Payment",
    categories: ["FINANCIAL"],
    createCategory: "FINANCIAL",
    defaultOpen: false,
    offers: offersFor("FINANCIAL"),
    suggestions: [],
  },
  {
    id: "other",
    label: "Other",
    categories: ["CUSTOM"],
    createCategory: "CUSTOM",
    defaultOpen: false,
    offers: offersFor("CUSTOM"),
    suggestions: [],
  },
];

/** The section a field of this category is listed under. Every category has exactly one. */
export function sectionForCategory(category: FieldCategory): ProfileSection {
  return (
    PROFILE_SECTIONS.find((section) => section.categories.includes(category)) ??
    PROFILE_SECTIONS[PROFILE_SECTIONS.length - 1]
  );
}

/**
 * The suggestions a section still has to draw as blank rows: every one no field in the section
 * answers yet. Child fields are excluded before matching, so a child's birthday never reads as
 * the owner's own date of birth.
 */
export function openSuggestions(
  section: ProfileSection,
  sectionFields: readonly ProfileField[],
): readonly FieldSuggestion[] {
  const candidates = sectionFields.filter(
    (field) => field.value.trim() !== "" && !isChildNameField(field),
  );
  return section.suggestions.filter(
    (suggestion) => !candidates.some((field) => suggestion.matches(field)),
  );
}

/** Every suggestion, flattened — for the contract test that proves the ids are unique. */
export const ALL_SUGGESTIONS: readonly FieldSuggestion[] = PROFILE_SECTIONS.flatMap(
  (section) => section.suggestions,
);
