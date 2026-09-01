/**
 * What a template *starts a card with* — the field preset its blurb promises.
 *
 * ## Why this module has to exist
 *
 * There are two templates and, since the palette split, a template chooses only a default
 * colour, a name weight and a button shape. None of those is what a template *is*. The
 * registry says so in as many words — "A template is now purely the *purpose* — the fields it
 * starts with" — and both blurbs make the promise out loud:
 *
 *   · Meridian: "For work. Starts with your work number and work email."
 *   · Marigold: "For everyone else. Starts with your mobile and personal email."
 *
 * Nothing kept that promise. `/templates` flagged the gap explicitly ("which fields a template
 * actually *seeds* on a new card is a builder behaviour and belongs there") and pointed here.
 * Without this file the two templates differ by a default colour and a hundred units of font
 * weight, which is the same "eight templates are one template eight times" failure the palette
 * split was meant to end.
 *
 * ## Why it is a preference list and not a list of ids
 *
 * A card is a *filter over the owner's own profile* (§5.3), so a seed cannot name field ids —
 * those belong to one particular profile. It names **(category, type) pairs**, which is the
 * same coordinate system `resolveCard` sorts on, and resolves them against whatever profile it
 * is handed. A profile with no work phone seeds one field; an empty profile seeds none and the
 * builder opens on the §11 E-01 warning, which is the honest outcome rather than a crash.
 *
 * ## Two rules the resolution keeps
 *
 * 1. **A seed never opts the owner into sharing a sensitive field.** `isSensitive` fields are
 *    excluded outright. A preset is a convenience; silently ticking a home address or an
 *    account number because it happened to be the only PHONE in `PERSONAL` is not.
 * 2. **A seed never picks a blank field** — the same §11 E-07 exclusion `resolveCard` applies,
 *    made here too so a seeded id can never resolve to nothing and read as a lost field.
 *
 * Pure: no clock, no randomness, no I/O, no mutation of its inputs. Same arguments, same ids,
 * in the same order, every time — which is what lets the builder's reducer stay pure while
 * still re-seeding on a template switch.
 */

import { TEMPLATES } from "@/card/templates";
import type { TemplateCategory, TemplateId } from "@/card/template-types";
import type {
  CardType,
  FieldCategory,
  FieldGroup,
  FieldType,
  ProfileField,
} from "@/types/domain";

/**
 * A template's category, as a `CardType`.
 *
 * Two axes that happen to agree, and they agree in exactly one place. `/templates` needs it to
 * pick a showcase card of the right kind; the builder needs it to stamp a new card, because
 * `cardType` is what the share face's role tag falls back to when no `JOB_TITLE` is mapped —
 * so a new Marigold card says "Personal" and a new Meridian card says "Business" without the
 * owner touching anything. It lived as a private constant inside the gallery, which is a
 * mapping waiting to drift the moment a second caller needs it. This is that second caller.
 */
export const CARD_TYPE_FOR_CATEGORY: Record<TemplateCategory, CardType> = {
  business: "BUSINESS",
  personal: "PERSONAL",
};

/**
 * One entry in a seed: "the owner's WORK phone", not "field_work_phone".
 *
 * `category` **and** `type` together, because neither alone says what the blurb says. `PHONE`
 * alone cannot tell a mobile from a desk number, and `WORK` alone cannot tell a phone from a
 * fax. The pair is exactly the coordinate `resolveCard` orders on, so a seed is expressed in
 * the vocabulary the rest of the card system already uses.
 */
export interface SeedPreference {
  category: FieldCategory;
  type: FieldType;
}

/**
 * The presets, transcribed from the blurbs and deliberately no longer than they are.
 *
 * Two entries each. It is tempting to seed Meridian with `JOB_TITLE` and `COMPANY` as well —
 * they would fill the face's role tag and brand chip, and the card would look better in the
 * first frame. That is the argument for changing the *blurb*, not for quietly seeding more than
 * it says: a preset that adds fields the owner was not told about is the builder deciding what
 * they share. Whatever this record says, the gallery caption must say too.
 *
 * `Record<TemplateId, …>` is load-bearing — a third template cannot be added without deciding
 * what it starts with, because omitting it fails `tsc --noEmit`.
 */
export const TEMPLATE_SEED: Record<TemplateId, readonly SeedPreference[]> = {
  meridian: [
    { category: "WORK", type: "PHONE" },
    { category: "WORK", type: "EMAIL" },
  ],
  marigold: [
    { category: "PERSONAL", type: "PHONE" },
    { category: "PERSONAL", type: "EMAIL" },
  ],
};

/** The `CardType` a new card of this template is stamped with. */
export function seedCardType(templateId: TemplateId): CardType {
  return CARD_TYPE_FOR_CATEGORY[TEMPLATES[templateId].category];
}

/**
 * Resolve a template's preset against one profile.
 *
 * Returns profile field ids in **preset order** — the order the blurb reads in, so the seeded
 * card's first detail pair is the number and its second is the email, matching the face's own
 * `FACE_FIELD_PREFERENCE`. Ids are unique and every one resolves: a caller can hand the result
 * straight to `ContactCard.fieldIds`.
 *
 * Never throws, and never returns a dangling id. A profile that satisfies nothing returns `[]`,
 * which is a card that maps zero fields — surfaced by the builder as §11 E-01 rather than
 * papered over with a fallback nobody asked for.
 */
export function seedFieldIds(
  templateId: TemplateId,
  groups: readonly FieldGroup[],
  fields: readonly ProfileField[],
): string[] {
  const categoryByGroupId = new Map(groups.map((group) => [group.id, group.category] as const));

  const picked: string[] = [];

  for (const preference of TEMPLATE_SEED[templateId]) {
    /* `fields` in declaration order is the owner's own ordering, so two work phones resolve to
       the one they listed first — the same tie-break `selectDetailPairs` uses on the face. */
    const match = fields.find(
      (field) =>
        !picked.includes(field.id) &&
        field.type === preference.type &&
        categoryByGroupId.get(field.groupId) === preference.category &&
        // Rule 1: a preset never ticks something the owner marked sensitive.
        !field.isSensitive &&
        // Rule 2: and never something that would resolve to nothing (§11 E-07).
        field.value.trim().length > 0,
    );

    if (match !== undefined) picked.push(match.id);
  }

  return picked;
}
