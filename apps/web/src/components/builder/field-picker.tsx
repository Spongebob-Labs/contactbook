"use client";

import { Plus, SquarePen, X } from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactElement } from "react";

import { Button } from "@/components/primitives";
import { cn } from "@/lib/cn";
import type { FieldGroup, FieldType, ProfileField } from "@/types/domain";

import { AddFieldDialog, MaskedMarker, type CreatedField } from "./add-field-dialog";
import { buildFieldRows, offerableRows, selectedRows, type BuilderFieldRow } from "./field-rows";
import { PanelHead } from "./panel-head";
import { BUILDER_SCROLL_CLEAR } from "./scroll-clear";

/**
 * The **Fields** section — a card is a *filter over the owner's profile*, and this is the filter.
 *
 * ## What this used to be, and why it is not that any more
 *
 * It was **every** profile field, grouped into seven headed sections, each row a checkbox. On
 * the fixture profile that is 34 checkboxes and roughly 1,400px of column, and it answered the
 * wrong question. The owner's question is *"what is on this card?"*, and a list of everything
 * with two things ticked makes them find the answer by scanning for ticks.
 *
 * So the section is now the shape Linktree uses for the same job:
 *
 *   1. a **header row** — the section's `<h2>` and a primary **+ Add**;
 *   2. **the fields already on this card**, one row each, with their values and a remove
 *      control per row;
 *   3. an **empty state** when the card maps nothing, offering the same + Add.
 *
 * Choosing from the profile happens in `add-field-dialog.tsx`, behind that button.
 *
 * ## ⚠ The list is in the card's order, not the order they were added
 *
 * `selectedRows` sorts with §6.4's own comparator — the one `resolveCard` uses — so row three
 * here is row three on the card and property three in the `.vcf`. Insertion order was the other
 * option and it is worse for one specific reason: a list that disagrees with the card it
 * describes teaches the owner that the order is arbitrary, and the order is not arbitrary — it
 * is what makes the exported file byte-stable. **This is not a reorder control and there is no
 * drag handle.** Linktree has one; we do not, because our rows are not links on a page the owner
 * owns the layout of, they are vCard properties.
 *
 * ## ⚠ The old failure this file exists to not repeat — and what it actually was
 *
 * §8D.4's second recorded failure: the old build's Step 2 embedded a **12-row profile editor**,
 * so one screen had two competing commit affordances and no answer to which one had been
 * pressed. For a long time this file honoured that by having no inputs at all, and
 * `builder.spec.ts` enforced it by counting them and asserting zero.
 *
 * **That was a proxy, and it has been replaced by the invariant itself.** The rows are editable
 * now — the owner changes a phone number where they are looking at it — and the ruling is
 * unharmed, because the ruling was never "no inputs":
 *
 * 1. **One commit affordance.** Every keystroke goes to the reducer; the single "Save changes"
 *    in the toolbar commits the lot. **No row saves itself**, and a per-row Save would be
 *    §8D.4's failure again, once per row.
 * 2. **Nothing in this list creates a field.** Editing a value that exists is not authoring one,
 *    and the suite checks that every input here belongs to a row already on the card. Making a
 *    *new* field happens in one place — `New field` inside `<AddFieldDialog>` — which writes to
 *    the profile and never to the card's field set, so this rule survives intact.
 *
 * ## ⚠ An edit here is an edit to the PROFILE, and the copy has to say so
 *
 * A card is a *filter over the owner's profile, not a copy* (PRODUCT.md). There is one work
 * mobile, and every card mapping it shows the same one — so changing it here changes it on all
 * of them. That is stated in the section's own intro (`BUILDER_SECTIONS`) and again in the Save
 * toast, because a screen that quietly edited five other cards would be the most expensive kind
 * of surprise this product can produce.
 *
 * ## Which rows are editable, and why the rest are not
 *
 * `row.editable` comes from `isInlineEditable` — one definition, on the row model, read by both
 * surfaces. **A masked field is never editable here**: §7.3 says a masked value must not reach
 * the DOM "not as text, not in an attribute", and `<input value={…}>` is that attribute. An
 * `ADDRESS` is excluded for a different reason — seven components a one-line box would flatten
 * — and both kinds of row offer a link to `/profile` instead of an input.
 *
 * ## What a row may show, and what it may never show
 *
 * A non-sensitive value already renders on a public card, so showing it here is not a
 * disclosure — and it is the only way to tell two work numbers apart. A **masked** field shows a
 * marker and *no value node at all*: §7.3 puts reveal in `/profile` and nowhere else, so the raw
 * string is absent from this document entirely — not as text, not in a `title`. `isMaskedField`
 * decides that, upstream in `field-rows.ts`, and both this list and the dialog read the same
 * rows so they cannot disagree about it.
 *
 * ## Hooks
 *
 * | hook | what it marks |
 * |---|---|
 * | `[data-field-picker]` | the section root |
 * | `[data-add-field-open]` | the **+ Add** button (header and empty state both carry it) |
 * | `[data-field-rows]` | the list of fields on the card, with `data-field-count` |
 * | `[data-field-row="{id}"]` | one field on the card |
 * | `[data-field-row-icon]` | that row's type glyph — decorative, `aria-hidden` |
 * | `[data-field-remove="{id}"]` | that row's remove control |
 * | `[data-field-row-value]` | a row's display value — **absent on a masked or editable row** |
 * | `[data-field-row-input="{id}"]` | that row's value input — **only on an editable row** |
 * | `[data-field-row-note="{id}"]` | a blank/shape note under the input |
 * | `[data-field-edit-elsewhere="{id}"]` | the `/profile` link a non-editable row offers |
 * | `[data-fields-empty]` | the card maps nothing, but the profile has fields |
 * | `[data-field-picker-empty]` | the *profile* has nothing (§11 E-08) |
 * | `[data-add-field]` | the `/profile` deep link |
 *
 * The dialog's own hooks — `[data-add-field-dialog]`, `[data-add-field-search]`,
 * `[data-add-field-category]`, `[data-add-field-result]` — are documented in
 * `add-field-dialog.tsx`. They are **portalled**, so they land under `<body>`, outside both
 * `[data-field-picker]` and `[data-builder]`.
 *
 * ⚠ `[data-field-option="{id}"]` still means "a row for this field" and is on **both** surfaces:
 * this list, and the dialog's result rows. That is the honest reading of the attribute and it is
 * what keeps older locators pointing at something real — but it means a bare
 * `[data-field-option="x"]` matches twice while the dialog is open and trips Playwright's strict
 * mode. **Scope it**: `[data-field-picker] [data-field-option="x"]` for the card's copy,
 * `[data-add-field-dialog] [data-field-option="x"]` for the offer.
 */

export interface FieldPickerProps {
  groups: readonly FieldGroup[];
  fields: readonly ProfileField[];
  /** The ids currently on the card. */
  selected: readonly string[];
  onToggle: (fieldId: string, on: boolean) => void;
  /**
   * One field's value, as typed. Live — there is no per-row commit, and see the ⚠ in
   * `FieldRow` for why there must not be one.
   */
  onEditValue: (fieldId: string, value: string) => void;
  /**
   * Create a profile field and put it on this card — forwarded to `<AddFieldDialog>`.
   *
   * Optional so a surface with no API to write to can omit it; the create control is then absent
   * rather than present and broken.
   */
  onCreateField?: (draft: {
    type: FieldType;
    label: string;
    value: string;
  }) => Promise<CreatedField | null>;
  /** True while that create is in flight. */
  creatingField?: boolean;
  /**
   * The panel head's copy, from this section's `BUILDER_SECTIONS` entry.
   *
   * ⚠ Passed in rather than written here, and that is the point: the rail, the panel title and
   * this component would otherwise be three places that name the same section, and the one that
   * goes stale is always the one nobody is looking at.
   */
  title: string;
  intro: string;
  /**
   * Whether the Add-field dialog is open.
   *
   * ⚠ Lifted out of this component deliberately, and the earlier note arguing the opposite is
   * superseded: the E-01 warning bar — which lives above the split view, outside this panel —
   * now opens the same dialog. State with two openers cannot belong to one of them.
   */
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}

export function FieldPicker({
  groups,
  fields,
  selected,
  onToggle,
  onCreateField,
  creatingField,
  onEditValue,
  title,
  intro,
  addOpen,
  onAddOpenChange,
}: FieldPickerProps): ReactElement {

  /** Every offerable field in the profile. One derivation, read by both surfaces. */
  const rows = useMemo(() => buildFieldRows(groups, fields), [groups, fields]);
  /* ⚠ What the **dialog** may offer — §11 E-07 applied here and not in the row model, so a
     field the owner has blanked keeps its row in the list below while disappearing from the
     things they can add. See `offerableRows`. */
  const offerable = useMemo(() => offerableRows(rows), [rows]);
  /** What the card carries, in the order the card renders it. */
  const onCard = useMemo(() => selectedRows(rows, selected), [rows, selected]);

  /**
   * §11 E-08 — the profile itself is empty, reached by `?state=empty`. Distinct from "this card
   * maps nothing": there is nothing to *offer*, so there is no + Add to offer it with, and the
   * only useful thing this section can say is "go and make a field".
   */
  const profileEmpty = offerable.length === 0;

  return (
    <div data-field-picker="" className="flex flex-col gap-4">
      {/* ── header row ─────────────────────────────────────────────────────────── */}
      {/* ⚠ The panel head lives here rather than in `builder-client.tsx` because the **+ Add**
          button sits on the title's baseline and the button opens a dialog whose state belongs
          to this component. It is the same `<PanelHead>` the other two panels render, given the
          same copy from the same `BUILDER_SECTIONS` entry — so "Fields looks different from
          Design" is not a thing that can drift, only the file that calls it differs. */}
      {/* ⚠ Offered even when the profile is empty, which it did not used to be. The dialog could
          only *select* back then, so on an empty profile it had nothing to show and the button
          was a door into an empty room. It can author now, so it is exactly the right door — and
          withholding it would leave an empty profile with no way forward at all. */}
      <PanelHead title={title} intro={intro} action={<AddButton onClick={() => onAddOpenChange(true)} />} />

      {profileEmpty ? (
        <div
          data-field-picker-empty=""
          className="flex flex-col items-start gap-3 rounded-lg border border-line bg-surface-sunk px-6 py-8"
        >
          <p className="text-base text-ink">There are no fields to add yet.</p>
          <p data-prose className="text-sm text-ink-3">
            A card shares fields from your profile, so there has to be something in your profile
            first. Make one here and it lands in your profile and on this card at once.
          </p>
          <AddButton onClick={() => onAddOpenChange(true)} />
        </div>
      ) : onCard.length === 0 ? (
        /* The card maps nothing on a healthy profile. Deliberately *not* the E-01 warning —
           that bar is above the split view and owns the consequence ("anyone who scans it will
           only get your name"). This says what to do about it, once, where the doing happens. */
        <div
          data-fields-empty=""
          className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line bg-surface-sunk px-6 py-8"
        >
          <p className="text-base text-ink">This card doesn&rsquo;t share anything yet.</p>
          <p data-prose className="text-sm text-ink-3">
            Add fields from your profile and they appear on the card as you go. Editing a field
            once changes it on every card that maps it.
          </p>
          <AddButton onClick={() => onAddOpenChange(true)} />
        </div>
      ) : (
        <>
          <ul
            data-field-rows=""
            /* The count the e2e suite reads. It is the number of rows this list renders, which
               is not `resolved.fieldCount` — a mapped PHOTO is a row here and is consumed by
               the avatar there — so it is published separately rather than inferred. */
            data-field-count={onCard.length}
            className="flex flex-col gap-2"
          >
            {onCard.map((row) => (
              <FieldRow
                key={row.field.id}
                row={row}
                onEditValue={(value) => onEditValue(row.field.id, value)}
                onRemove={() => onToggle(row.field.id, false)}
              />
            ))}
          </ul>
        </>
      )}

      <AddFieldDialog
        open={addOpen}
        onOpenChange={onAddOpenChange}
        rows={offerable}
        selected={selected}
        /* Add only. The dialog never removes, and it never closes itself on an add — see the
           note there on why an owner adds three fields in one pass. */
        onAdd={(fieldId) => onToggle(fieldId, true)}
        onCreateField={onCreateField}
        creating={creatingField}
      />
    </div>
  );
}

/**
 * The one control that opens the modal, rendered in two places.
 *
 * Both carry `[data-add-field-open]` and both are the same component, because "the header's Add
 * and the empty state's Add do the same thing" is the sort of claim that stops being true the
 * second time somebody edits one of them.
 */
function AddButton({ onClick }: { onClick: () => void }): ReactElement {
  return (
    <Button
      type="button"
      data-add-field-open=""
      onClick={onClick}
      /* `BUILDER_SCROLL_CLEAR` for the same reason the checkboxes carried it: at 360 the
         pinned preview is `sticky` over the top of this column, and a control focused by
         keyboard scrolls to just under it without a scroll margin. */
      className={BUILDER_SCROLL_CLEAR}
    >
      <Plus aria-hidden="true" className="size-4" />
      Add
    </Button>
  );
}

/**
 * How a value that does not look like its type is reported: quietly, and without blocking.
 *
 * ⚠ Deliberately shape checks and not validation. §11 E-01 owns the only blocked Save in this
 * builder (an empty card) and nothing else may grow a second one — a card whose owner typed a
 * work extension into a phone field is their card, not an error state. What these earn is a
 * line of text under the input, so a typo is visible before it is handed to a stranger.
 */
function valueNote(row: BuilderFieldRow, value: string): string | null {
  if (value.trim() === "") {
    /* §11 E-07, said where it happens. A blank value is not a field: `resolveCard` drops it,
       so the row has already vanished from the card two inches to the right. Saying so beats
       letting the owner wonder why the preview lost a line while they were typing. */
    return "Blank fields are not shared, so this one is off the card until you fill it in.";
  }
  if (row.field.type === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    return "That does not look like an email address.";
  }
  if (row.field.type === "URL" && /\s/.test(value.trim())) {
    return "A web address cannot contain a space.";
  }
  return null;
}

/** One field on the card: what it is, what it says, how to change it, and how to take it off. */
function FieldRow({
  row,
  onEditValue,
  onRemove,
}: {
  row: BuilderFieldRow;
  onEditValue: (value: string) => void;
  onRemove: () => void;
}): ReactElement {
  const inputId = `builder-field-${row.field.id}`;
  const noteId = `${inputId}-note`;
  const note = row.editable ? valueNote(row, row.field.value) : null;

  return (
    <li
      data-field-row={row.field.id}
      /* Retained from the checkbox list: `[data-field-option="{id}"]` has always meant "a row
         for this field", and it still does. It is on the dialog's result rows too. */
      data-field-option={row.field.id}
      data-field-editable={row.editable ? "" : undefined}
      /* ⚠ A row of its own rather than a hairline-separated line item, and the reason is what
         the row *is*: one thing this card shares, which the owner adds, edits, and takes away.
         A divided list reads as a table of values; a stack of rows reads as a set of objects,
         which is what the card page below turns each of them into. */
      className={cn(
        "flex items-start gap-3 rounded-xl border border-line bg-canvas px-3 py-2.5",
        "transition-colors duration-[var(--dur-fast)] focus-within:border-ink-4 hover:bg-surface",
      )}
    >
      {/* The same type glyph the modal's rows carry, from the same `FIELD_RENDERERS` element on
          the same row model. Decorative and `aria-hidden`: the label says what the field is. */}
      <span
        data-field-row-icon=""
        aria-hidden="true"
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-sunk text-ink-2"
      >
        {row.icon}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          {/* ⚠ A real `<label>` on the editable rows. The field's name is the input's name —
              anything else would leave six inputs in this list announcing themselves as
              "edit text" and nothing more. */}
          {row.editable ? (
            <label htmlFor={inputId} className="text-xs text-ink-3">
              {row.field.label}
            </label>
          ) : (
            <span className="text-sm text-ink">{row.field.label}</span>
          )}
          {row.masked ? <MaskedMarker sensitive={row.field.isSensitive} /> : null}
        </span>

        {row.editable ? (
          /* ⚠ **An input, not a value that turns into one when clicked.**
             A click-to-edit line is invisible until it is discovered, and the whole complaint
             this answers was that the value looked like a label. It is styled quietly — no
             chrome until hover or focus — but it is a real text box at rest, which is the only
             way a control announces itself without a second affordance beside it.

             ⚠ **No per-row Save, ever.** §8D.4's second recorded failure was a builder with two
             competing commit affordances and no answer to which one had been pressed. Every
             keystroke goes to the reducer and the one "Save changes" in the toolbar commits the
             lot — the same rule the colour picker and the name field already obey. */
          <input
            id={inputId}
            type="text"
            data-field-row-input={row.field.id}
            value={row.field.value}
            onChange={(event) => onEditValue(event.target.value)}
            aria-describedby={note === null ? undefined : noteId}
            spellCheck={false}
            autoComplete="off"
            className={cn(
              "w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 -mx-1.5",
              "text-sm text-ink placeholder:text-ink-4",
              "transition-colors duration-[var(--dur-fast)]",
              "hover:border-line hover:bg-surface-sunk",
              "focus:border-ink-4 focus:bg-canvas focus:outline-none",
              BUILDER_SCROLL_CLEAR,
            )}
          />
        ) : (
          /* Not editable here, and the row says which of the two reasons applies. A masked row
             still prints **no value node at all** — not empty, absent (§7.3). */
          <>
            {row.display === null ? null : (
              <span
                data-field-row-value=""
                /* Kept under its old name too: `[data-field-option-value]` is what the masking
                   assertions look for, and the claim they make ("a masked field prints no value
                   here") is exactly as true of this list as it was of the checkbox one. */
                data-field-option-value=""
                className="truncate text-xs text-ink-3"
              >
                {row.display}
              </span>
            )}
            {/* ⚠ A real `<a href="/profile">`, not a modal or an inline reveal. For a masked
                row that is §7.3 — reveal exists in one place and this is not it — and for an
                address it is honesty about scope: a seven-component postal address needs the
                profile's own editor, not a one-line box that would silently flatten it. */}
            <Link
              href="/profile"
              data-field-edit-elsewhere={row.field.id}
              className="inline-flex w-fit items-center gap-1.5 text-xs text-ink-2 underline underline-offset-4"
            >
              <SquarePen aria-hidden="true" className="size-3.5" />
              {row.masked ? "Change it in your profile" : "Edit in your profile"}
            </Link>
          </>
        )}

        {note === null ? null : (
          /* `role="status"`, not `alert`: nothing failed and nothing is blocked. It is the same
             register as the Design panel's clamp note, for the same reason. */
          <span
            id={noteId}
            data-field-row-note={row.field.id}
            role="status"
            className="text-xs text-ink-2"
          >
            {note}
          </span>
        )}
      </div>

      <button
        type="button"
        data-field-remove={row.field.id}
        /* Named for the field. "Remove" six times over is six identical stops for anyone
           navigating by control, and this one is destructive-ish — it changes what the card
           shares (§8.8, AC-25). */
        aria-label={`Remove ${row.field.label}`}
        onClick={onRemove}
        className={cn(
          "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-3",
          "transition-colors duration-[var(--dur-fast)] hover:bg-surface-sunk hover:text-ink",
          BUILDER_SCROLL_CLEAR,
        )}
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}

