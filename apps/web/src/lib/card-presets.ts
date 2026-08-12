/**
 * Turns the user's existing cards into "start from" presets for the create wizard.
 *
 * A card owns no data of its own, and no endpoint lists the profile field ids
 * mapped to it — so a preset can only describe itself in `ShareableFieldType`
 * terms: the selection the user saved for that card
 * (see `@/lib/card-field-selection`), or, when there is none, the types the
 * card's own type can supply that actually hold a profile value.
 *
 * Step 3 of the wizard then re-resolves those types against the *new* card's
 * type, because a Work card has no personal-only rows to show.
 */
import {
  EMPTY_ADDRESS,
  isAddressEmpty,
  listCardProfileFields,
  type CardProfileField,
} from "@/lib/card-profile-fields";
import {
  isShareableFieldType,
  SHAREABLE_FIELD_TYPES,
  type ShareableFieldType,
} from "@/lib/card-share-types";
import type { ContactCard, ContactCardType, ProfileMeResponse } from "@/lib/types";

/** An existing card, described as something a new card can be started from. */
export type CardPreset = {
  cardId: string;
  name: string;
  type: ContactCardType;
  /** Field types this card shares, in canonical `SHAREABLE_FIELD_TYPES` order. */
  offers: ShareableFieldType[];
  /** The source card has no mapped fields, so copying it yields a name-only vCard. */
  isEmpty: boolean;
};

/** One row of step 3: a profile field, whether the preset gives it, and whether it is filled in. */
export type PresetFieldRow = {
  field: CardProfileField;
  offered: boolean;
  isEmpty: boolean;
};

function inCanonicalOrder(types: ReadonlySet<ShareableFieldType>): ShareableFieldType[] {
  return SHAREABLE_FIELD_TYPES.filter((type) => types.has(type));
}

/** Address rows keep their parts in `address` and always carry a blank `value`. */
function isRowEmpty(field: CardProfileField): boolean {
  if (field.inputKind === "address") {
    return isAddressEmpty(field.address ?? EMPTY_ADDRESS);
  }
  return field.value.trim().length === 0;
}

/**
 * Describes one card as a preset.
 *
 * `savedSelection` is the user's stored intent. An absent *or empty* one means
 * "share everything" at /vcard time — an inverted default we refuse to show as
 * "shares nothing" — so both fall back to the profile-backed set.
 */
export function toCardPreset(
  card: ContactCard,
  savedSelection: ShareableFieldType[] | undefined,
  profile: ProfileMeResponse | null,
): CardPreset {
  const universe = listCardProfileFields(profile, card.type);
  const supported = new Set(universe.map((field) => field.type));
  // Guards against types stored by an older build and types this card's type
  // stopped supplying — both would advertise a row the preset cannot give.
  const saved = (savedSelection ?? []).filter(
    (type) => isShareableFieldType(type) && supported.has(type),
  );
  const offers =
    saved.length > 0
      ? saved
      : universe.filter((field) => !isRowEmpty(field)).map((field) => field.type);

  return {
    cardId: card.id,
    name: card.name,
    type: card.type,
    offers: inCanonicalOrder(new Set(offers)),
    // `undefined` means the API omitted the list, which is unknown, not empty.
    isEmpty: card.mappedFieldIds?.length === 0,
  };
}

/** Every card as a preset, most recently updated first — that is the one step 2 preselects. */
export function listCardPresets(
  cards: ContactCard[],
  selections: Record<string, ShareableFieldType[]>,
  profile: ProfileMeResponse | null,
): CardPreset[] {
  return [...cards]
    .sort((a, b) => {
      // Cards that carry no details first-class-fail as presets: copying one
      // produces a contact file holding only a name. Ranking on recency alone
      // preselected whichever card was made last, which is exactly the empty
      // one, so new cards inherited nothing. Usable presets come first; an
      // unknown count counts as usable, since demoting it could bury the only
      // card that has details.
      const emptiness = Number(isKnownEmpty(a)) - Number(isKnownEmpty(b));
      if (emptiness !== 0) {
        return emptiness;
      }
      // Array#sort is stable, so cards sharing a timestamp keep the API's order.
      return updatedAtMs(b) - updatedAtMs(a);
    })
    .map((card) => toCardPreset(card, selections[card.id], profile));
}

/** True only when the card is *known* to have no attached fields. */
function isKnownEmpty(card: ContactCard): boolean {
  return card.mappedFieldIds?.length === 0;
}

function updatedAtMs(card: ContactCard): number {
  const parsed = Date.parse(card.updatedAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * The rows step 3 renders, split into the preset's own fields and the
 * "Add more fields" remainder. A `null` preset is "Start blank" — everything
 * lands in `additional` so the user is never trapped.
 */
export function resolvePresetFields(
  preset: CardPreset | null,
  newCardType: ContactCardType,
  profile: ProfileMeResponse | null,
): { offered: PresetFieldRow[]; additional: PresetFieldRow[] } {
  const offers = new Set<ShareableFieldType>(preset?.offers ?? []);
  const offered: PresetFieldRow[] = [];
  const additional: PresetFieldRow[] = [];

  for (const field of listCardProfileFields(profile, newCardType)) {
    const row: PresetFieldRow = {
      field,
      offered: offers.has(field.type),
      isEmpty: isRowEmpty(field),
    };
    (row.offered ? offered : additional).push(row);
  }

  return { offered, additional };
}

/** The types step 3 starts ticked: everything the preset offers that has a value to share. */
export function defaultSelectionFor(
  preset: CardPreset | null,
  newCardType: ContactCardType,
  profile: ProfileMeResponse | null,
): ShareableFieldType[] {
  const { offered } = resolvePresetFields(preset, newCardType, profile);
  const filled = offered
    .filter((row) => !row.isEmpty)
    .map((row) => row.field.type);
  return inCanonicalOrder(new Set(filled));
}
