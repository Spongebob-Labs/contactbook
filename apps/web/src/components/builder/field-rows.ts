import { ImageIcon } from "lucide-react";
import { createElement, type ReactNode } from "react";

import { FACE_FIELD_PREFERENCE } from "@/card/share-face";
import { FIELD_RENDERERS, isInlineEditable, isMaskedField } from "@/card/field-renderers";
import { compareResolvedFields } from "@/card/resolve-card";
import { clampText } from "@/lib/format";
import type { FieldCategory, FieldGroup, ProfileField, ResolvedField } from "@/types/domain";

/**
 * One row model, read by both halves of the builder's Fields section.
 *
 * The section is two surfaces over the same set — the list of fields **on the card**, and the
 * "Add a field" modal's list of fields **in the profile** — and the single worst thing they
 * could do is disagree. Two lists that print different text for the same field, or order it
 * differently, or mask it in one place and not the other, would each be individually plausible
 * and collectively a security hole. So neither of them derives anything: they both call
 * {@link buildFieldRows} and render what it returns.
 *
 * ## The three rules this module is the single enforcement point for
 *
 * 1. **`isMaskedField` decides masking, never a local `isSensitive` read.** It is the one
 *    definition (the three financial types are masked whatever the owner marked), and a row it
 *    calls masked carries `display: null` — *no value node at all*, not as text and not in a
 *    `title`. §7.3 puts reveal in `/profile` and nowhere else, so the raw string is absent from
 *    the builder's document entirely. `builder.spec.ts` asserts the literal `50100412345678`
 *    appears nowhere, and this `null` is why.
 * 2. **Display strings *and* type icons come from `FIELD_RENDERERS`.** The picker and the card
 *    cannot print different text, or a different glyph, for the same field, because there is one
 *    renderer table and both read it. The icon is carried on the row rather than looked up at
 *    render time for the same reason the display string is: a second lookup is a second table
 *    waiting to disagree, and §6.6 already assigns exactly one glyph per `FieldType`.
 * 3. **§11 E-07: a blank value is not a field.** A field whose value trims to nothing renders
 *    as no row on the card and is excluded from the `.vcf`, so it is not offerable here either.
 *    Offering it would let the owner "add" something that then does not appear.
 *
 * ## And the ordering rule it does NOT own
 *
 * {@link sortCanonically} sorts by `compareResolvedFields` — §6.4's own comparator, imported
 * from `resolve-card.ts` rather than transcribed. That is what makes "the list matches the card"
 * true by construction instead of by review. There is no owner-defined order in this product:
 * the owner chooses *which* fields, and the resolver chooses the sequence, because that sequence
 * is what makes a `.vcf` byte-stable.
 */

/** Categories in declaration order — §6.4's primary sort key, and the owner's own order. */
export const FIELD_CATEGORY_ORDER: readonly FieldCategory[] = [
  "IDENTITY",
  "PERSONAL",
  "WORK",
  "BUSINESS",
  "SOCIAL",
  "FINANCIAL",
  "CUSTOM",
];

export interface BuilderFieldRow {
  /** The profile field this row stands for. `field.id` is every hook's key. */
  field: ProfileField;
  /** The category of the owning group — the §6.4 primary sort key. */
  category: FieldCategory;
  /**
   * The `ResolvedField` shape the card would carry, kept so this row can be handed straight to
   * §6.4's comparator. Building it here rather than at two call sites is what stops the two
   * surfaces from sorting on subtly different objects.
   */
  resolved: ResolvedField;
  /** The display string the card itself would print. `null` when the field is masked. */
  display: string | null;
  /**
   * §6.6's glyph for this field's type — the **same element the card draws**, at the 16px size
   * §8.8 reserves for list rows.
   *
   * Decorative and `aria-hidden` at every call site: it is the field's *type*, which the label
   * beside it already says in words, so nothing may rest on it alone (§8.8, AC-25).
   *
   * ⚠ **Never `null`.** See {@link NO_ROW_ICON} — a row with no glyph leaves a hole in the tile
   * column, which shifts the label beside it and reads as a broken row.
   */
  icon: ReactNode;
  masked: boolean;
  /**
   * May the Fields panel offer an input for this row's value?
   *
   * From {@link isInlineEditable}, on the row rather than recomputed at render, for the same
   * reason `display` and `icon` are: a second lookup is a second table waiting to disagree —
   * and the thing it would disagree about here is whether a masked value reaches the DOM.
   */
  editable: boolean;
  /**
   * §11 E-07: this field's value trims to nothing, so the **card** does not render it and the
   * `.vcf` excludes it. See {@link offerableRows} for why the row still exists.
   */
  blank: boolean;
}

/**
 * The glyph for a field whose renderer contributes **no card row at all**.
 *
 * `FIELD_RENDERERS` returns `null` for exactly one type — `PHOTO` — because a photograph is not
 * a labelled row on the card: §6.6 feeds it to the avatar slot instead. It is still a perfectly
 * real, perfectly offerable profile field, so the builder lists it on both surfaces and the
 * owner can add or remove it. It just arrives with no icon attached to it.
 *
 * This is the one glyph in the builder that is *not* read out of `FIELD_RENDERERS`, and it is
 * not the beginning of a per-type table: it is the single fallback for the single type the
 * registry declines to render, chosen here — in the row model — rather than in the two
 * components, so both surfaces cannot disagree about it. The size and stroke match what
 * `buildFieldRows` asks the registry for below, so the fallback and its neighbours are the same
 * weight of drawing.
 */
const NO_ROW_ICON: ReactNode = createElement(ImageIcon, {
  "aria-hidden": true,
  size: 16,
  strokeWidth: 1.5,
});

/** Longer than this and a value stops being a way to tell two work numbers apart. */
const DISPLAY_CLAMP = 44;

/**
 * Every field in the profile, one row each.
 *
 * ⚠ **Blank-valued fields are included here now, and the E-07 filter moved to
 * {@link offerableRows}.** It used to `continue` past them in this loop, which was right for
 * the one caller that existed — the Add dialog, where offering a field that then does not
 * appear is a lie — and became a trap the moment the Fields list grew inputs: clearing a value
 * deleted the row out from under the cursor, mid-keystroke, with no way to type it back short
 * of leaving for `/profile`. Two different questions were sharing one filter:
 *
 * · *May the owner add this?* — no, a blank field would add nothing. `offerableRows`.
 * · *Is this on the card?* — that is `state.fieldIds`, and a value being blank right now does
 *   not un-map it. `selectedRows`, which keeps the row and lets `blank` speak for itself.
 *
 * The card is unaffected either way: `resolveCard` applies E-07 where the card is built, so a
 * blanked field leaves the preview immediately whatever this list shows.
 *
 * Membership comes from `field.groupId` — the same direction `resolveCard` reads it — rather
 * than from `group.fieldIds`. Reading the group's own array instead would let a group that has
 * drifted out of step with its members hide a field the card can still map.
 *
 * Returned in the profile's declaration order, which is the owner's own order. Callers that
 * need §6.4's order call {@link sortCanonically}; callers that are showing the *profile*
 * (the modal's category lists) want the owner's order and leave it alone.
 */
export function buildFieldRows(
  groups: readonly FieldGroup[],
  fields: readonly ProfileField[],
): readonly BuilderFieldRow[] {
  const categoryByGroupId = new Map(groups.map((group) => [group.id, group.category] as const));

  const rows: BuilderFieldRow[] = [];

  for (const field of fields) {
    const category = categoryByGroupId.get(field.groupId);
    // A field whose group is gone is not reachable through the profile and has no category to
    // sort on — the same condition `resolveCard` drops into `droppedFieldIds` (I-2).
    if (category === undefined) continue;
    const resolved: ResolvedField = {
      id: field.id,
      type: field.type,
      category,
      label: field.label,
      value: field.value,
      isSensitive: field.isSensitive,
      ...(field.detail === undefined ? {} : { detail: field.detail }),
    };

    const masked = isMaskedField(field);
    const editable = isInlineEditable(field);
    const rendered = FIELD_RENDERERS[field.type](resolved, { iconSize: 16 });

    rows.push({
      field,
      category,
      resolved,
      // A masked field contributes no value node at all — see rule 1 in the module note.
      display: masked || rendered === null ? null : clampText(rendered.display, DISPLAY_CLAMP),
      /* The glyph survives masking. It names the *type* — "this is a bank account" — which the
         row already says in its label and its "Sensitive" marker, so it discloses nothing the
         screen was not going to print anyway. Dropping it would leave a hole in the column
         exactly on the rows the owner most needs to recognise at a glance. `PHOTO` is the one
         type with no glyph of its own; see `NO_ROW_ICON`. */
      icon: rendered === null ? NO_ROW_ICON : rendered.icon,
      masked,
      editable,
      blank: field.value.trim().length === 0,
    });
  }

  return rows;
}

/**
 * The rows a picker may **offer**, i.e. everything with something to contribute.
 *
 * §11 E-07 lives here rather than in `buildFieldRows`: offering a blank field would let the
 * owner add something that then does not appear on their card.
 */
export function offerableRows(
  rows: readonly BuilderFieldRow[],
): readonly BuilderFieldRow[] {
  return rows.filter((row) => !row.blank);
}

/** §6.4's order — the order the card renders in and the `.vcf` is written in. */
export function sortCanonically(
  rows: readonly BuilderFieldRow[],
): readonly BuilderFieldRow[] {
  return [...rows].sort((a, b) => compareResolvedFields(a.resolved, b.resolved));
}

/**
 * The rows the card currently carries, in the order the card renders them.
 *
 * `selected` is `state.fieldIds`, so this deliberately covers **more** than
 * `ResolvedCard.fields` does: a mapped `PHOTO` is consumed by the avatar slot and appears in no
 * field array at all (§6.6), and a list built from the resolved card would therefore show the
 * owner a photograph on their card that they had no row to remove. An id with no row — dangling
 * after the profile moved underneath the builder — simply produces nothing, which is §11 E-40's
 * "never a ghost row"; the `DroppedFieldsNotice` above the split view is what reports it.
 *
 * ⚠ **Blank rows are kept.** A mapped field whose value the owner has just cleared is still
 * mapped — it has to stay in this list, wearing its `blank` flag, or the input they are typing
 * in disappears the moment they select-all-delete.
 */
export function selectedRows(
  rows: readonly BuilderFieldRow[],
  selected: readonly string[],
): readonly BuilderFieldRow[] {
  const chosen = new Set(selected);
  return sortCanonically(rows.filter((row) => chosen.has(row.field.id)));
}

/** How many fields *Suggested* offers before it stops being a shortlist. */
export const SUGGESTED_LIMIT = 6;

/**
 * The modal's opening offer: fields **not yet on the card**, best first, capped.
 *
 * "Best" is the face's own preference order — `PHONE`, then `EMAIL`, then `URL` — read from
 * `FACE_FIELD_PREFERENCE` rather than repeated, because those are precisely the three types
 * that can reach the share face, and the face is the artefact the owner is looking at while
 * they choose. Everything else ranks behind them, in category declaration order, so a shortlist
 * for a profile with no phone or email still reads identity → personal → work rather than
 * whatever the array happened to hold.
 *
 * §6.4's comparator breaks every remaining tie, so the shortlist is deterministic: two work
 * emails resolve the same way on every render, which is what makes it assertable at all.
 */
export function suggestedRows(
  rows: readonly BuilderFieldRow[],
  selected: readonly string[],
  limit: number = SUGGESTED_LIMIT,
): readonly BuilderFieldRow[] {
  const chosen = new Set(selected);
  const faceRank = (row: BuilderFieldRow): number => {
    const index = FACE_FIELD_PREFERENCE.indexOf(row.field.type);
    return index === -1 ? FACE_FIELD_PREFERENCE.length : index;
  };
  const categoryRank = (row: BuilderFieldRow): number =>
    FIELD_CATEGORY_ORDER.indexOf(row.category);

  return rows
    .filter((row) => !chosen.has(row.field.id))
    .slice()
    .sort(
      (a, b) =>
        faceRank(a) - faceRank(b) ||
        categoryRank(a) - categoryRank(b) ||
        compareResolvedFields(a.resolved, b.resolved),
    )
    .slice(0, limit);
}

/**
 * Does this row match what the owner typed?
 *
 * **Only what is on screen is searchable.** A row matches on its label, on the category it is
 * filed under, and on its *displayed* value — which for a masked row is nothing at all. That is
 * not a convenience: making a masked value searchable would let this box confirm digits of an
 * account number by which queries filter it in, which is the same disclosure §7.3 forbids
 * printing, arrived at one keystroke at a time.
 */
export function rowMatches(
  row: BuilderFieldRow,
  query: string,
  categoryLabel: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  const haystack = [row.field.label, categoryLabel, row.display ?? ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}
