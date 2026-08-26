import {
  resolveCardSurface,
  type Finish,
  type Texture,
  type TexturePresence,
  type TextureScale,
} from "@/card/card-surface";
import type { PaletteId } from "@/card/template-palettes";
import { seedCardType } from "@/card/template-seed";
import type { TemplateId } from "@/card/template-types";
import { TEMPLATES, TEMPLATE_ORDER } from "@/card/templates";
import type { CardType, ContactCard, ProfileField } from "@/types/domain";

/**
 * The card builder's state, as a pure reducer (spec §8D.4, plan T23).
 *
 * ## Why a reducer at all, and why it is pure
 *
 * §8D.4: **every interaction is live, there is no "apply", no "next", no wizard step, and
 * exactly one commit affordance — Save.** So there is no place to put "pending" changes: every
 * control writes into this state and the preview re-renders from it. That makes this module the
 * builder's actual behaviour rather than plumbing, which is why it is a pure function with its
 * own test file instead of a scatter of `useState` calls in a component nobody can test without
 * a browser.
 *
 * Pure means pure: no clock, no randomness, no `window`, and the state it is handed is never
 * mutated. `saveCount` exists instead of a `savedAt` timestamp for exactly that reason.
 *
 * ## The one rule that is easy to get backwards
 *
 * A **template** is what the card is *for*. A **palette** is what it looks like. They used to be
 * a single field, and splitting them is the only reason there are two of them — the model was
 * making somebody who wanted a navy personal card pick the *business* template and then change
 * its colour anyway.
 *
 * Two consequences, and the reducer enforces both:
 *
 *   1. A template switch may re-seed the fields and adopt the template's own default colour —
 *      **only while the owner has not made that choice themselves.** `paletteChosen` and
 *      `fieldsTouched` are what "themselves" means, which is why they are state and not
 *      derived: once a person has expressed a preference, no preset may overwrite it.
 *   2. A preset is an *opening offer*. On an existing card it is not on offer at all. Replacing
 *      a card's five mapped fields with a two-field preset because the owner tried a different
 *      template would be the builder deleting their card in front of them.
 *
 * ## The material system is four more axes, and they obey the same rules
 *
 * `groundHex`, `finish`, `texture` and its `texturePresence`/`textureScale` dials are
 * `@/card/card-surface`'s axes — the Design panel's controls — and they are held here for exactly the reason the two
 * above are: every one of them is live, none of them has an "apply", and the preview is a pure
 * function of this state. Three notes worth having in one place:
 *
 *   1. **`groundHex` and `paletteId` are one axis, not two.** A preset *is* a colour choice, so
 *      choosing one clears `groundHex` and choosing a free colour makes the preset irrelevant.
 *      Two independent fields would let the state say "Sapphire, and also #C2410C", and the
 *      screen would then have to invent a precedence rule that the owner never saw. Instead the
 *      rule is stated once, here: **`groundHex` wins while it is set; clearing it falls back to
 *      the curated palette**, which is exactly what `CardSurface.groundHex`'s own contract says.
 *   2. **`finish` and `texture` are independent, and there is no remembered motif.** The old
 *      state had to keep a `patternId` alive while the style was `grain` or `flat`, because one
 *      axis was carrying two decisions. Two axes carry two decisions: `texture` IS the motif, it
 *      is never shadowed by the finish, and the "remember it for when they come back" rule the
 *      old model needed has nothing left to remember.
 *   3. **Nothing here validates a colour.** `derivePalette` decides whether a ground can carry
 *      legible text and clamps it if it cannot (see `LEGIBILITY_DEAD_BAND`). A reducer that also
 *      had an opinion would be a second, weaker legibility rule — and the wrong place for it,
 *      because the answer depends on contrast arithmetic this module must stay too pure to do.
 *
 * ## What this module deliberately does NOT decide
 *
 * Whether the card shares anything. That is `canBuildVcf` (T11) — one definition, read by the
 * meter, the disabled Save and the public page alike. A `fieldIds.length === 0` here would be a
 * second definition of "empty", and a links-only card would be warned about wrongly the first
 * time the two drifted.
 *
 * Nor whether a chosen ground was legible. That is `derivePalette`'s, and the note it hands
 * back is surfaced beside the picker rather than turned into a rejected action.
 */

/** The name a card is born with. A prompt to name it, never a blank box. */
export const BUILDER_NEW_CARD_NAME = "Untitled card";

/**
 * The slug an unsaved card previews under.
 *
 * A card that has not been saved has no public URL, so the QR in the preview has to encode
 * *something*. It encodes this, which keeps the symbol's density and byte budget honest (the
 * real thing is the same shape) while not pretending a URL exists — scanning a card mid-build
 * lands on a card that genuinely is not there yet, rather than on somebody else's.
 */
export const BUILDER_PREVIEW_SLUG = "preview";

/**
 * The id an unsaved card previews under.
 *
 * `card_`-prefixed like every fixture id, because §11 E-38 / AC-05 turn on nothing else being
 * addressable as `/cards/new`, and a preview object that broke the prefix convention would be
 * the first exception to a rule the whole route table depends on.
 */
export const BUILDER_PREVIEW_CARD_ID = "card_preview_unsaved";

export interface BuilderState {
  /** `null` on `/cards/new` — there is no card yet, and Save creates rather than updates. */
  readonly cardId: string | null;
  readonly userId: string;
  readonly name: string;
  readonly cardType: CardType;
  readonly slug: string;
  readonly templateId: TemplateId;
  /** Always concrete here. A picker with no selection has no tick to draw. */
  readonly paletteId: PaletteId;
  /**
   * The owner's free ground colour, `#RRGGBB`, or `undefined` while a preset is in use.
   *
   * The one field on this state that is deliberately allowed to be absent, because absence is a
   * meaning and not a gap: it is "the nine curated palettes still apply". A card cannot be on a
   * preset *and* on a free colour, so the Background control shows a tick on the preset while
   * this is `undefined` and on the custom swatch while it is set — one selection, one axis.
   */
  readonly groundHex: string | undefined;
  /** How the colour is laid down. Concrete, defaulted by `resolveCardSurface`. */
  readonly finish: Finish;
  /** What is cut into it, `none` included. Independent of `finish` — see the module note. */
  readonly texture: Texture;
  /** How far the texture moves the ground away from the ink. */
  readonly texturePresence: TexturePresence;
  /** Multiplier on the texture's authored tile. */
  readonly textureScale: TextureScale;
  readonly fieldIds: readonly string[];
  /**
   * ⚠ **Edited field VALUES, and they are a profile overlay rather than card state.**
   *
   * A card is a *filter over the profile* (PRODUCT.md), so a value belongs to the profile and
   * every card mapping that field shows the same one. Editing "Work mobile" here is editing the
   * owner's work mobile — not this card's copy of it, because there is no copy. Keyed by field
   * id and sparse: a field absent from this map is wearing whatever the profile says.
   *
   * It is held here, beside `fieldIds`, because the two are committed by the same **one** Save.
   * §8D.4's second recorded failure was a builder with two commit affordances and no answer to
   * which one had been pressed; a row that saved itself would be exactly that failure again,
   * one row at a time. `builderCard` deliberately does **not** carry these — see
   * {@link builderProfileEdits}.
   */
  readonly fieldValues: Readonly<Record<string, string>>;
  /** True once the owner has picked a colour by hand. Nothing may overwrite it after that. */
  readonly paletteChosen: boolean;
  /** True once the owner has ticked or unticked anything. No preset may overwrite them after. */
  readonly fieldsTouched: boolean;
  /** Unsaved changes. Drives the Save affordance's label, never whether it is allowed. */
  readonly dirty: boolean;
  /** Commits so far. A count rather than a timestamp, because a clock is not pure. */
  readonly saveCount: number;
}

export type BuilderAction =
  | { kind: "rename"; name: string }
  /**
   * `seed` is the template's preset **already resolved against the owner's profile**, because
   * this reducer cannot reach the profile and stay pure. The reducer still owns the *policy* —
   * whether the seed applies at all — which is the part worth testing.
   */
  | { kind: "template"; templateId: TemplateId; seed: readonly string[] }
  | { kind: "palette"; paletteId: PaletteId }
  /**
   * A free ground colour, `#RRGGBB` from the Design panel's colour input.
   *
   * The same axis as `palette` and its mirror image: this sets `groundHex`, that clears it.
   */
  | { kind: "ground"; hex: string }
  | { kind: "finish"; finish: Finish }
  | { kind: "texture"; texture: Texture }
  | { kind: "presence"; texturePresence: TexturePresence }
  | { kind: "scale"; textureScale: TextureScale }
  | { kind: "field"; fieldId: string; on: boolean }
  /** One field's value, as typed. Live, like every other axis — there is no per-row commit. */
  | { kind: "value"; fieldId: string; value: string }
  | { kind: "save" };

export interface BuilderInit {
  /** The card being edited, or `null` on `/cards/new`. */
  card: ContactCard | null;
  /** The signed-in owner. Only read for a new card. */
  userId: string;
  /** The default template's preset, resolved against the profile. New cards only. */
  seed: readonly string[];
}

/** The template a new card opens on. Declaration order, so it is the same one every time. */
const DEFAULT_TEMPLATE_ID: TemplateId = TEMPLATE_ORDER[0];

export function builderInitialState({ card, userId, seed }: BuilderInit): BuilderState {
  /* ⚠ **The defaults come from `resolveCardSurface`, never from a literal here.** It is the
     contract's own single place for them, and it defaults the style to `gradient` precisely
     because that is what every card already renders — so opening the builder on a card written
     before this system existed adds three axes to the state without changing a pixel of the
     preview. A `"gradient"` written out here instead would be a second copy of that decision,
     and the first one to go stale. `undefined` is the honest argument for a new card: it has no
     surface of its own yet, so it gets the same defaults an old card gets. */
  const surface = resolveCardSurface(card ?? undefined);

  if (card === null) {
    return {
      cardId: null,
      userId,
      name: BUILDER_NEW_CARD_NAME,
      cardType: seedCardType(DEFAULT_TEMPLATE_ID),
      slug: BUILDER_PREVIEW_SLUG,
      templateId: DEFAULT_TEMPLATE_ID,
      paletteId: TEMPLATES[DEFAULT_TEMPLATE_ID].paletteId,
      groundHex: undefined,
      finish: surface.finish,
      texture: surface.texture,
      texturePresence: surface.texturePresence,
      textureScale: surface.textureScale,
      fieldIds: [...seed],
      fieldValues: {},
      paletteChosen: false,
      fieldsTouched: false,
      dirty: false,
      saveCount: 0,
    };
  }

  return {
    cardId: card.id,
    userId: card.userId,
    name: card.name,
    cardType: card.type,
    slug: card.slug,
    templateId: card.templateId,
    /* A card with no `paletteId` is wearing its template's default and has *not* chosen —
       so trying a different template still moves its colour, which is what somebody who
       never picked one would expect. A card that carries one has chosen, and it is final. */
    paletteId: card.paletteId ?? TEMPLATES[card.templateId].paletteId,
    /* The card's own ground if it carries one. Not defaulted to the palette's `ground`: a card
       on a preset must stay on the preset, because a preset is nine measured values and its
       `ground` is only one of them. Flattening it to a hex here would silently demote every
       existing card to a derived palette on the first edit. */
    groundHex: card.groundHex,
    finish: surface.finish,
    texture: surface.texture,
    texturePresence: surface.texturePresence,
    textureScale: surface.textureScale,
    /* Copied, never aliased: the fixtures are frozen `as const` arrays. */
    fieldIds: [...card.fieldIds],
    /* Empty on open, always. An edit is a change the owner makes in this session; seeding it
       from the profile would make every field look edited and `dirty` meaningless. */
    fieldValues: {},
    /* A free ground is a colour the owner picked by hand, so it counts as chosen for exactly
       the same reason a preset does: no later preset may overwrite it. */
    paletteChosen: card.paletteId !== undefined || card.groundHex !== undefined,
    fieldsTouched: false,
    dirty: false,
    saveCount: 0,
  };
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.kind) {
    case "rename":
      // Not validated here. A name is empty for as long as it takes to retype one, and a
      // reducer that rejected that would fight the keyboard.
      return { ...state, name: action.name, dirty: true };

    case "template": {
      const template = TEMPLATES[action.templateId];

      /* The preset is an opening offer: only for a card that does not exist yet, and only
         while the owner has not started choosing fields themselves. */
      const mayReseed = state.cardId === null && !state.fieldsTouched;

      return {
        ...state,
        templateId: action.templateId,
        /* A colour the owner picked survives every later template switch — see the module
           note. Only an unchosen colour follows the template. */
        paletteId: state.paletteChosen ? state.paletteId : template.paletteId,
        /* Only a new card is stamped: an existing card's type is content the owner has, in
           effect, already accepted, and no template picker should silently re-file it. */
        cardType: state.cardId === null ? seedCardType(action.templateId) : state.cardType,
        fieldIds: mayReseed ? [...action.seed] : state.fieldIds,
        dirty: true,
      };
    }

    case "palette":
      /* `groundHex: undefined` is the load-bearing half. A preset and a free colour are one
         axis, so choosing a preset has to *unset* the free colour rather than sit behind it —
         otherwise the card keeps rendering the old custom ground while the picker shows a tick
         on Sapphire, which is the picker lying about the card. */
      return {
        ...state,
        paletteId: action.paletteId,
        groundHex: undefined,
        paletteChosen: true,
        dirty: true,
      };

    case "ground":
      /* The mirror image, and deliberately **not** normalised, validated or rejected. The
         control is `<input type="color">`, whose value is always a `#rrggbb` string, and the
         one question worth asking about a colour — can text be read on it — is contrast
         arithmetic that belongs to `derivePalette` and is answered by clamping rather than by
         refusal (PRODUCT.md Principle 3, *freedom with a floor*).

         `paletteId` is left where it is on purpose: it is what the card falls back to the moment
         the owner picks a preset again, and losing it here would make "go back to a curated
         colour" mean "go back to the template's default". */
      return { ...state, groundHex: action.hex, paletteChosen: true, dirty: true };

    case "finish":
      /* Touches one axis. Choosing a finish never clears the texture: the two compose, and a
         reducer that "helpfully" reset the other would make the two controls impossible to
         reason about separately. */
      return { ...state, finish: action.finish, dirty: true };

    case "texture":
      /* Likewise one axis, `none` included — "no texture" is a value, not an absence, so
         choosing it is an ordinary transition rather than a clear. */
      return { ...state, texture: action.texture, dirty: true };

    case "presence":
      return { ...state, texturePresence: action.texturePresence, dirty: true };

    case "scale":
      return { ...state, textureScale: action.textureScale, dirty: true };

    case "value":
      /* No trimming and no validation here. §11 E-07 ("a blank value is not a field") is
         `resolveCard`'s rule and it is applied where the card is built, so a value the owner
         has cleared drops off the preview immediately and visibly. A reducer that quietly
         trimmed or rejected would make the panel and the card disagree about what was typed —
         and the owner would be arguing with a text box that edits itself. */
      return {
        ...state,
        fieldValues: { ...state.fieldValues, [action.fieldId]: action.value },
        dirty: true,
      };

    case "field": {
      const present = state.fieldIds.includes(action.fieldId);

      /* Idempotent in both directions — a double click, or a controlled checkbox firing
         twice under React's strict double-invoke, must not double a row or lose one. */
      const fieldIds = action.on
        ? present
          ? state.fieldIds
          : [...state.fieldIds, action.fieldId]
        : state.fieldIds.filter((id) => id !== action.fieldId);

      /* `fieldsTouched` is set even when the set did not change: the owner still expressed a
         preference, and a preset must not overwrite it on the next template switch. */
      return { ...state, fieldIds, fieldsTouched: true, dirty: true };
    }

    case "save":
      /* There is no persistence in this run (§3.1), so a commit is exactly this: the card is
         no longer unsaved, and the screen says so. Nothing about the card changes, and none
         of the owner's choices are reset — a saved card is still their card. */
      return { ...state, dirty: false, saveCount: state.saveCount + 1 };
  }
}

/**
 * The `ContactCard` the builder is describing — the single input `resolveCard` is called with.
 *
 * ⚠ This is invariant **I-5**'s seam in the builder. The card returned here is resolved **once**
 * by the screen, and the share face, the page preview, the field-count meter and anything that
 * would write a `.vcf` all receive that one `ResolvedCard` reference. A second `resolveCard`
 * call anywhere below would produce an object whose values match today and diverge the first
 * time the two derivations disagree — which is precisely the old build's "previewed file
 * differs from sent file" bug.
 *
 * `updatedAt` is a constant rather than `new Date()`: this must stay a pure function of state
 * (I-4), and nothing on either preview reads it.
 */
export function builderCard(state: BuilderState): ContactCard {
  return {
    id: state.cardId ?? BUILDER_PREVIEW_CARD_ID,
    userId: state.userId,
    name: state.name,
    type: state.cardType,
    isSensitive: false,
    slug: state.slug,
    templateId: state.templateId,
    paletteId: state.paletteId,
    /* ⚠ **The material system travels on the card, and that is the whole integration.**
       `groundHex` is spread conditionally rather than written as `undefined`, so a card on a
       preset carries no ground key at all — which is what `CardSurface.groundHex`'s contract
       means by "absent", and what lets `resolveCard` tell "no choice" from "this colour". The
       other three are always concrete because `resolveCardSurface` already defaulted them, and
       a card that states its own defaults renders identically to one that omits them.

       Nothing in the builder paints a ground. The four axes are put on the card here, the card
       is resolved **once** by the screen (I-5), and the renderer reads the resolution — so the
       preview and the page a recipient opens cannot disagree about what the card looks like,
       for the same structural reason they cannot disagree about what it says. */
    ...(state.groundHex === undefined ? {} : { groundHex: state.groundHex }),
    finish: state.finish,
    texture: state.texture,
    texturePresence: state.texturePresence,
    textureScale: state.textureScale,
    fieldIds: [...state.fieldIds],
    updatedAt: BUILDER_UPDATED_AT,
  };
}

/**
 * A fixed instant, because `builderCard` has to be pure and nothing on either preview surface
 * reads `updatedAt`. The card-detail screen is where a real timestamp belongs, and it gets it
 * from the fixture rather than from here.
 */
const BUILDER_UPDATED_AT = "2026-08-24T00:00:00.000Z";

/**
 * The profile edits this session is holding, as a plain map — **the other half of what Save
 * commits, and deliberately not part of `builderCard`.**
 *
 * `builderCard` returns a `ContactCard`, and a `ContactCard` has no field values on it: values
 * live on `ProfileField`, one copy, shared by every card that maps the field. Putting them on
 * the card would be the copy PRODUCT.md says does not exist, and the first card to save would
 * fork the owner's phone number.
 *
 * So a save is two writes against two stores from one button. This is the second one. In this
 * build neither is a write at all (§3.1 — Save is a stated outcome), which is exactly why the
 * shape has to be right now: the integration run should find one function to call, not a
 * decision to make.
 */
export function builderProfileEdits(state: BuilderState): Record<string, string> {
  return { ...state.fieldValues };
}

/**
 * The profile's fields with this session's edits laid over them.
 *
 * ⚠ **Call this ONCE per render and hand the result to everything.** I-5 is the rule that the
 * builder resolves its card exactly once so the pane and the panel cannot disagree; the same
 * argument applies a level down. If `resolveCard` saw the edited fields and the Fields list saw
 * the stored ones, the owner would be typing into a row that says one thing while the card two
 * inches away says another — which is the "previewed file differs from the sent file" defect in
 * miniature.
 *
 * Returns the original array when nothing is edited, so the common case allocates nothing and
 * every downstream `useMemo` keyed on it stays stable.
 */
export function applyFieldValues(
  fields: readonly ProfileField[],
  values: Readonly<Record<string, string>>,
): readonly ProfileField[] {
  if (Object.keys(values).length === 0) return fields;
  return fields.map((field) =>
    values[field.id] === undefined ? field : { ...field, value: values[field.id] },
  );
}
