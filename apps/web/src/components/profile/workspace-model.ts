import {
  PROFILE_SECTIONS,
  openSuggestions,
  pairChildren,
  type ChildEntry,
  type FieldSuggestion,
  type ProfileSection,
} from "@/components/builder/field-suggestions";
import { isSyntheticGroupId, toCardFieldEntries } from "@/lib/api/map";
import { API_GROUP_CATEGORIES, type ApiFieldCategory, type ApiGroupCategory } from "@/lib/api/schema";
import type { FieldGroup, ProfileField } from "@/types/domain";

/**
 * The pure half of the `/profile` workspace: which rows each section lists, which ids a card is
 * sent, and where a new field is filed. No React, so all of it is unit-testable.
 */

/** `PUT /cards/{id}/fields` accepts at most this many entries. */
export const CARD_FIELD_LIMIT = 200;

export interface WorkspaceSectionModel {
  section: ProfileSection;
  /** Filled fields listed as ordinary rows, in profile order. Children are not among them. */
  fields: ProfileField[];
  /** Personal only: each child with the birthday stored under their name. */
  children: ChildEntry[];
  /** Suggestions nothing answers yet — drawn as blank rows. */
  suggestions: readonly FieldSuggestion[];
  /** Real groups in this section, for the "Reorder or delete" links. */
  groups: FieldGroup[];
}

/**
 * Every section with its rows.
 *
 * Membership is by the owning group's category and the order is the groups' own (they arrive
 * sorted by category, then position), so a section lists fields exactly as the profile holds
 * them. `PHOTO` is skipped everywhere: the avatar at the top of the panel is its only control.
 */
export function workspaceSections(
  groups: readonly FieldGroup[],
  fields: readonly ProfileField[],
): WorkspaceSectionModel[] {
  const byId = new Map(fields.map((field) => [field.id, field]));

  return PROFILE_SECTIONS.map((section) => {
    const sectionGroups = groups.filter((group) => section.categories.includes(group.category));
    const listed: ProfileField[] = [];
    for (const group of sectionGroups) {
      for (const id of group.fieldIds) {
        const field = byId.get(id);
        if (field !== undefined && field.type !== "PHOTO") listed.push(field);
      }
    }

    const children = section.children === true ? pairChildren(listed) : [];
    const inChildren = new Set(
      children.flatMap((child) => [child.name.id, ...(child.birthday ? [child.birthday.id] : [])]),
    );

    return {
      section,
      fields: listed.filter((field) => !inChildren.has(field.id)),
      children,
      suggestions: openSuggestions(section, listed),
      groups: sectionGroups.filter((group) => !isSyntheticGroupId(group.id)),
    };
  });
}

/** A field a card can carry: `PUT /cards/{id}/fields` refuses `PHOTO`, and a blank value renders nothing. */
export function isCardableField(field: ProfileField): boolean {
  return field.type !== "PHOTO" && field.value.trim() !== "";
}

/**
 * The ids a new card starts with — every saved field the owner has filled in.
 *
 * Client: *"Fields already saved carry over to new cards automatically."* Capped at the API's
 * limit rather than failing the create.
 */
export function carryOverFieldIds(fields: readonly ProfileField[]): string[] {
  const ids: string[] = [];
  for (const field of fields) {
    if (!isCardableField(field) || isLocalFieldId(field.id)) continue;
    if (!ids.includes(field.id)) ids.push(field.id);
    if (ids.length === CARD_FIELD_LIMIT) break;
  }
  return ids;
}

/**
 * The body for `PUT /cards/{id}/fields`: the desired set, minus anything the API would refuse.
 *
 * The call is all-or-nothing upstream — one unknown id, a duplicate or a `PHOTO` fails the whole
 * write — so the set is filtered against the profile as it stands before it is sent.
 */
export function cardFieldPayload(
  desired: readonly string[],
  fields: readonly ProfileField[],
  /** Ids created this session that the profile read has not caught up with yet. */
  created: ReadonlySet<string> = new Set(),
): ReturnType<typeof toCardFieldEntries> {
  const known = new Map(fields.map((field) => [field.id, field]));
  const ids: string[] = [];
  for (const id of desired) {
    const field = known.get(id);
    if (isLocalFieldId(id)) continue;
    if (field === undefined ? !created.has(id) : field.type === "PHOTO") continue;
    if (!ids.includes(id)) ids.push(id);
  }
  return toCardFieldEntries(ids.slice(0, CARD_FIELD_LIMIT));
}

/** `profileDraftReducer` mints `field_local_N` for an add the server has not answered yet. */
export function isLocalFieldId(id: string): boolean {
  return id.startsWith("field_local_");
}

function isGroupCategory(category: ApiFieldCategory): category is ApiGroupCategory {
  return (API_GROUP_CATEGORIES as readonly string[]).includes(category);
}

/**
 * The real group a new field of this category joins, or `undefined` to create it loose.
 *
 * Only the four group-able categories can hold a `groupId` upstream; for the rest a group on
 * screen is synthetic and sending its id would 404.
 */
export function groupIdForCreate(
  category: ApiFieldCategory,
  groups: readonly FieldGroup[],
): string | undefined {
  if (!isGroupCategory(category)) return undefined;
  return groups.find((group) => group.category === category && !isSyntheticGroupId(group.id))
    ?.id;
}

/**
 * The tag for a WORK group created on the owner's first work field: the company name when there
 * is one, else "Work".
 */
export function workGroupTag(companyName: string | null | undefined): string {
  const trimmed = companyName?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.slice(0, 80) : "Work";
}
