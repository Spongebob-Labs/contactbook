"use client";

import { Check, EyeOff, Plus, Search } from "lucide-react";
import { useId, useMemo, useState, type ReactElement } from "react";

import { FIELD_CATEGORY_LABELS } from "@/components/app";
import { Dialog } from "@/components/overlay";
import { Button } from "@/components/primitives/button";
import { Input } from "@/components/primitives/input";
import { Select } from "@/components/primitives/select";
import { cn } from "@/lib/cn";
import type { FieldCategory, FieldType } from "@/types/domain";

import {
  FIELD_CATEGORY_ORDER,
  SUGGESTED_LIMIT,
  rowMatches,
  sortCanonically,
  suggestedRows,
  type BuilderFieldRow,
} from "./field-rows";

/**
 * **"Add a field" — the modal the builder's Fields section opens** (spec §8D.4).
 *
 * ## What replaced what, and why
 *
 * The Fields section used to be *every* profile field, grouped into seven headed sections, each
 * row a checkbox. On the fixture profile that is 34 rows and roughly 1,400px of scrolling in a
 * column whose other job is to show nine colour swatches. It also answered the wrong question:
 * an owner opening the builder wants to know **what is on this card**, and a list of everything
 * with two things ticked buries that answer inside its own inventory.
 *
 * So the section now shows the card, and *adding* is a deliberate act that happens here:
 * a search box, a category rail, and one row per field with an **Add** affordance. That is the
 * Linktree shape, and it is the right one because it separates "what have I got" from "what
 * could I have".
 *
 * ## ⚠ THIS MODAL SELECTS, AND — BEHIND ONE BUTTON — AUTHORS
 *
 * It used to do only the first, and the only route to a field the profile lacked was a deep link
 * at the foot: a real `<a href="/profile">`. That reading of §8D.4 was too broad. The recorded
 * failure was a **12-row profile editor embedded in step 2**, giving one screen two competing
 * commit affordances — "Save details" and "Next" — with no answer to which one the owner had
 * pressed. The defect is *two commit paths for the card*, not *any authoring anywhere*.
 *
 * The deep link had a cost of its own, and it was the larger one: it **threw away the builder
 * session**. Somebody halfway through composing a card, who notices a missing number, was told to
 * leave, make it, come back and find their place again — every single time. In practice that
 * means the field never gets made and the card ships short.
 *
 * So the link is gone and `New field` sits beside the search box. It calls the same
 * `POST /profile/fields` the profile screen calls — one write path, so a field made here is
 * indistinguishable from one made there and every other card can use it. It still adds **no**
 * second commit path for the card: the card is saved by the same tick mechanism as always, and
 * this form's button never writes the card's field set itself.
 *
 * The default state is unchanged — a search box, a rail, and rows. The author panel is collapsed
 * until asked for.
 *
 * ## The masking rule, restated where it is easiest to break
 *
 * A masked row shows a marker and **no value node at all**. That is decided by `isMaskedField`
 * upstream in `field-rows.ts`, so this component never sees the raw string for a masked field
 * and cannot leak it into a `title`, a `value` or a search index. See `rowMatches`, which is
 * where "you can only search for what you can see" is enforced.
 *
 * ## Adding does not close the dialog, and it does not move the list
 *
 * An owner setting up a card adds three or four fields in one pass, and a modal that closes on
 * every add turns that into four round trips through a scrim animation. So the row flips to
 * **Added** in place and the preview and the meter behind the scrim move immediately — there is
 * no intermediate commit anywhere in this builder (AC-29).
 *
 * *In place* is the load-bearing half. **Suggested** is by definition "fields not yet on the
 * card", so a live recomputation would delete each row the instant it was clicked and slide the
 * next one under the cursor — which mis-clicks, and which makes the thing you just added
 * disappear at the exact moment you want confirmation that it landed. The shortlist is therefore
 * computed **once, from the selection as it stood when the dialog opened** ({@link AddFieldBody}
 * captures it in its initial state, and Radix unmounts this subtree on close so the next open
 * recaptures). Rows added during a session stay put and read "Added".
 *
 * That is also why `rail` and `query` need no reset logic: they are state of a subtree that only
 * exists while the dialog is open, so every open starts on Suggested with an empty box. A modal
 * that reopens onto "FINANCIAL / 'bank'" from three minutes ago is showing a filtered list the
 * owner did not ask for and has to notice before they can act.
 *
 * ## The shape: an Add *sheet*, not a settings pane
 *
 * The mechanism was right and is untouched — it is still one Radix dialog, with the same search
 * box, the same eight-entry rail and the same Add/Added rows. What changed is that it now reads
 * like the thing it is modelled on:
 *
 * · **Every row carries its type's glyph**, in a tile down the left edge, so the list is scannable
 *   by shape before it is read. The glyph comes off {@link BuilderFieldRow.icon}, which is
 *   `FIELD_RENDERERS`' own element — the same one the card draws. There is deliberately **no
 *   icon table in this file**: a second mapping from `FieldType` to a glyph is a second thing to
 *   keep in step with §6.6, and the day it drifts the modal offers a phone under an envelope.
 * · **The tile is neutral, and that is a decision.** The reference colours its glyphs per item
 *   type; this product's chrome is white and its colour budget is spent entirely on the card's
 *   palette (the locked design direction). Seven category colours in the *editor* would compete
 *   with the nine palette swatches forty pixels away, on the one screen where judging a colour is
 *   the job. So the tile is `--surface-sunk` and the glyph is ink, everywhere.
 * · **The rail is separated by a rule, not by a gap**, and the rows are given room. The previous
 *   sizing was a 9.5rem rail four pixels from a list of 20px rows; at that density the rail read
 *   as the first column of the list rather than as a filter over it.
 *
 * ⚠ The glyph is decorative on every row (`aria-hidden`), and the label beside it is what names
 * the field. §8.8: meaning never rests on an icon alone.
 */

/** The rail's first entry. Not a `FieldCategory` — it is a ranking, not a filing. */
export const SUGGESTED_RAIL_ID = "SUGGESTED";

type RailId = typeof SUGGESTED_RAIL_ID | FieldCategory;

/** What a successful create produced, so the dialog can show the owner where it landed. */
export interface CreatedField {
  fieldId: string;
  /** Which rail entry now holds it. The dialog jumps there — see {@link AddFieldBody}. */
  category: FieldCategory;
}

export interface AddFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every offerable field in the profile, in the owner's own order. */
  rows: readonly BuilderFieldRow[];
  /** The ids currently on the card. Drives the Added state and the Suggested shortlist. */
  selected: readonly string[];
  /** Adds one field. Never removes — see the module note. */
  onAdd: (fieldId: string) => void;
  /**
   * Create a **new profile field** and put it on this card, without leaving the builder.
   *
   * The same `POST /profile/fields` the profile screen calls — one write path, so a field made
   * here is indistinguishable from one made there. Resolves with the created field so this dialog
   * can move the rail to it, or `null` when the create failed (the caller has already said so).
   *
   * Omitted only by a surface with no API to write to, and then the create control is absent
   * rather than broken.
   */
  onCreateField?: (draft: {
    type: FieldType;
    label: string;
    value: string;
  }) => Promise<CreatedField | null>;
  /** True while a create is in flight. */
  creating?: boolean;
}

export function AddFieldDialog({
  open,
  onOpenChange,
  rows,
  selected,
  onAdd,
  onCreateField,
  creating = false,
}: AddFieldDialogProps): ReactElement {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      overline="From your profile"
      title="Add a field"
      description="A card is a filter over your profile. Pick what this one shares, or make a new one."
      size="lg"
      /* Wider than `size="lg"`'s 44rem. The dialog holds a rail *and* a list, and at 44rem the
         list column was 26rem — narrow enough that a clamped 44-character value and its Add
         button fought for the same row. `cn`'s `twMerge` makes a caller's `max-w-*` beat the
         size class, which is the documented way to override it (see `dialog.tsx`). The
         `w-[calc(100vw-…)]` underneath is untouched, so this changes nothing below 800px. */
      className="max-w-[50rem]"
      closeLabel="Close add field"
    >
      {/* Mounted only while open — see the module note on why that is the reset mechanism. */}
      <AddFieldBody
        rows={rows}
        selected={selected}
        onAdd={onAdd}
        onCreateField={onCreateField}
        creating={creating}
      />
    </Dialog>
  );
}

function AddFieldBody({
  rows,
  selected,
  onAdd,
  onCreateField,
  creating,
}: {
  rows: readonly BuilderFieldRow[];
  selected: readonly string[];
  onAdd: (fieldId: string) => void;
  onCreateField?: AddFieldDialogProps["onCreateField"];
  creating: boolean;
}): ReactElement {
  const [rail, setRail] = useState<RailId>(SUGGESTED_RAIL_ID);
  const [query, setQuery] = useState("");
  /** Whether the create panel under the search row is showing. */
  const [composing, setComposing] = useState(false);
  /**
   * The selection as it stood when this dialog opened. The shortlist is computed from it and
   * never from `selected`, so adding a suggested field marks it rather than removing it.
   */
  const [baseline] = useState<readonly string[]>(selected);
  const searchId = useId();

  const chosen = useMemo(() => new Set(selected), [selected]);
  const searching = query.trim().length > 0;

  /**
   * What the right-hand list shows.
   *
   * Three cases, and the order of the branches is the behaviour:
   *
   * · **a query beats the rail.** Typing "gst" while *Suggested* is selected must find GSTIN,
   *   or the search box is lying about its scope. So a non-empty query searches the whole
   *   profile and the rail marks nothing as current — the alternative, filtering inside the
   *   selected category, produces the "I can see it isn't there, but it is" moment that makes
   *   people stop trusting a search box. Clicking a category clears the query, because the
   *   query is the thing that was overriding it.
   * · **Suggested** is the capped shortlist, in the face's preference order, from `baseline`.
   * · **a category** is that category's fields — added ones included, so the owner can see what
   *   is already spoken for — in §6.4's order, which is the order the card puts them in.
   */
  const results = useMemo<readonly BuilderFieldRow[]>(() => {
    if (searching) {
      return sortCanonically(
        rows.filter((row) => rowMatches(row, query, FIELD_CATEGORY_LABELS[row.category])),
      );
    }
    if (rail === SUGGESTED_RAIL_ID) return suggestedRows(rows, baseline, SUGGESTED_LIMIT);
    return sortCanonically(rows.filter((row) => row.category === rail));
  }, [baseline, query, rail, rows, searching]);

  function selectRail(next: RailId) {
    setQuery("");
    setRail(next);
  }

  /**
   * Make the field, then show the owner where it went.
   *
   * ⚠ The rail jump is not a flourish. A field created here is put on the card by the same
   * action, and **Suggested is by definition "not on the card"** — computed from the baseline
   * captured at open, so a new field can never appear in it. Leaving the rail where it was would
   * therefore mean pressing Add and watching nothing change, on the one interaction that most
   * needs to be seen to have worked. So the rail moves to the category the field landed in,
   * where it renders among its siblings already marked **Added**.
   *
   * The query is cleared for the same reason: a stale filter would hide the new row behind a
   * search the owner typed before it existed.
   */
  async function create(draft: { type: FieldType; label: string; value: string }) {
    if (onCreateField === undefined) return false;
    const created = await onCreateField(draft);
    // `null` means the create failed and the caller has already reported it. The panel stays open
    // with the values still in it, because retyping a lost draft is the worst possible answer.
    if (created === null) return false;
    setQuery("");
    setRail(created.category);
    setComposing(false);
    return true;
  }

  /* Categories with nothing in them are not offered. A rail entry that always resolves to an
     empty list is a filter that can only disappoint — the gallery's rail learned the same
     lesson twice (see `category-rail.tsx`). */
  const railCategories = FIELD_CATEGORY_ORDER.filter((category) =>
    rows.some((row) => row.category === category),
  );

  return (
    <div data-add-field-dialog="" className="flex flex-col gap-5">
      {/* ── search, and the way to make something that is not there ───────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Not `<Input>`: this box sits inside a dialog that already carries the accessible name,
            its label is visually redundant, and `Input`'s `Field` wrapper would add a label row
            and a message slot that never fill. It carries its own `sr-only` `<label>` instead, so
            it is named for a screen reader and unlabelled on screen. */}
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-line-control bg-surface px-4">
          <Search aria-hidden="true" className="size-4.5 shrink-0 text-ink-3" />
          <label htmlFor={searchId} className="sr-only">
            Search your fields
          </label>
          <input
            id={searchId}
            data-add-field-search=""
            type="search"
            autoComplete="off"
            placeholder="Search your fields"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-3"
          />
        </div>

        {/* ⚠ The escape hatch, and it does not leave the builder.
            It used to be `<a href="/profile">` — which loses the session: the owner came here to
            put a number on a card and was told to go to another screen, make it, come back and
            find it again. The field is authored here now, through the same `POST /profile/fields`
            the profile screen calls, so it belongs to the profile exactly as if it had been made
            there and every other card can use it. */}
        {onCreateField === undefined ? null : (
          <button
            type="button"
            data-add-field-new=""
            aria-expanded={composing}
            onClick={() => setComposing((was) => !was)}
            className={cn(
              "inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg px-4",
              "text-sm transition-colors duration-[var(--dur-fast)]",
              composing
                ? "bg-ink text-canvas"
                : "border border-line-control bg-surface text-ink hover:bg-surface-sunk",
            )}
          >
            <Plus aria-hidden="true" className="size-4" />
            New field
          </button>
        )}
      </div>

      {composing && onCreateField !== undefined ? (
        <CreateFieldForm onCreate={create} busy={creating} onCancel={() => setComposing(false)} />
      ) : null}

      {/* The rail and the results, separated by a real rule at `sm` and above — see the module
          note. Below `sm` the rail is a horizontal strip of chips over the list, where a
          vertical rule would have nothing to divide. */}
      <div className="grid gap-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
        {/* ── the category rail ─────────────────────────────────────────────────── */}
        {/* Buttons rather than links: the gallery's rail is a URL because a template category
            is shareable, and this one is transient dialog state no address bar should carry.
            `aria-current` marks the active entry — and marks nothing while a query is
            overriding the rail, which is the honest reading of what is on screen. */}
        <nav
          aria-label="Field categories"
          className={cn(
            "flex gap-1 overflow-x-auto pb-1",
            "sm:flex-col sm:overflow-visible sm:pb-0",
            /* The separation the reference has and this did not: a hairline down the inline
               edge, with real room either side of it. `border-e`/`pe-*` rather than
               `border-r`/`pr-*` so the rule lands on the correct side under `dir="rtl"`. */
            "sm:border-e sm:border-line sm:pe-6",
          )}
        >
          <RailButton
            id={SUGGESTED_RAIL_ID}
            label="Suggested"
            active={!searching && rail === SUGGESTED_RAIL_ID}
            onSelect={selectRail}
          />
          {railCategories.map((category) => (
            <RailButton
              key={category}
              id={category}
              label={FIELD_CATEGORY_LABELS[category]}
              active={!searching && rail === category}
              onSelect={selectRail}
            />
          ))}
        </nav>

        {/* ── the results ───────────────────────────────────────────────────────── */}
        <div className="min-w-0">
          {/* The scroll container is on the *list*, and nowhere near a card. The dialog body is
              already `max-h` + `overflow-y-auto`; capping the list as well keeps the search box
              and the rail on screen while the results move under them, which is the whole
              reason the rail is worth having. */}
          <ul
            data-add-field-results=""
            data-add-field-searching={searching ? "" : undefined}
            data-add-field-result-count={results.length}
            className="flex max-h-[min(28rem,52svh)] min-w-0 flex-col overflow-y-auto"
          >
            {results.map((row) => (
              <ResultRow
                key={row.field.id}
                row={row}
                added={chosen.has(row.field.id)}
                onAdd={onAdd}
              />
            ))}
          </ul>

          {results.length === 0 ? (
            <p data-add-field-no-results="" className="py-6 text-sm text-ink-3">
              {searching
                ? `No fields match “${query.trim()}”.`
                : rows.length === 0
                  ? "Your profile has no fields yet. Make one with New field above."
                  : "Everything in your profile is already on this card."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Author a field the profile does not have yet, from inside the builder.
 *
 * ## Why this exists instead of a link to `/profile`
 * §8D.4's recorded failure was a **12-row profile editor embedded in step 2**, which gave one
 * screen two competing commit affordances — "Save details" and "Next" — and no answer to which
 * one the owner had pressed. That ruling is about *editing the profile inside a card flow*, and
 * this is not that: three inputs and one button that creates exactly one field and closes. There
 * is still no second commit path for the card — the card is saved by the same mechanism as every
 * other tick, and this form's button never touches it.
 *
 * ## The type list is deliberately short
 * These are the types somebody reaches for mid-build. The full 21-member set lives on `/profile`,
 * where a field is being *authored* rather than added in passing. `PHOTO` is absent on purpose —
 * the API rejects it here (`PHOTO_VIA_UPLOAD_ONLY`) and the profile's upload control owns it.
 */
const QUICK_TYPES: ReadonlyArray<{ value: FieldType; label: string }> = [
  { value: "PHONE", label: "Phone" },
  { value: "EMAIL", label: "Email" },
  { value: "JOB_TITLE", label: "Job title" },
  { value: "COMPANY", label: "Company" },
  { value: "URL", label: "Website" },
  { value: "SOCIAL_LINK", label: "Social link" },
  { value: "ADDRESS", label: "Address" },
  { value: "TEXT", label: "Anything else" },
];

function CreateFieldForm({
  onCreate,
  busy,
  onCancel,
}: {
  onCreate: (draft: { type: FieldType; label: string; value: string }) => Promise<boolean>;
  busy: boolean;
  onCancel: () => void;
}): ReactElement {
  const [type, setType] = useState<FieldType>("PHONE");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      data-create-field-form=""
      className="flex w-full flex-col gap-3 rounded-lg border border-line bg-surface-sunk p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim().length === 0) {
          // Checked here rather than at the API: a blank value is rejected upstream too, but a
          // round trip to be told so reports a local mistake as a server failure.
          setError("Give the field a value — a blank one would not show on the card.");
          return;
        }
        setError(null);
        void onCreate({
          type,
          /* Defaulted rather than demanded. The type already says what the row is, and one more
             required box is one more reason to give up on this and go to /profile instead — which
             is the exact trip this form exists to remove. */
          label:
            label.trim().length > 0
              ? label.trim()
              : (QUICK_TYPES.find((quick) => quick.value === type)?.label ?? "Field"),
          value: value.trim(),
        }).then((created) => {
          // Cleared only on success. A failed create keeps the draft, because the alternative is
          // making somebody retype what they just lost.
          if (!created) return;
          setLabel("");
          setValue("");
        });
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          label="Kind"
          value={type}
          onValueChange={(next) => setType(next as FieldType)}
          items={QUICK_TYPES.map((quick) => ({ value: quick.value, label: quick.label }))}
          fieldClassName="sm:w-44 sm:shrink-0"
        />
        <Input
          label="Label"
          data-create-field-label=""
          placeholder="Optional"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          fieldClassName="min-w-0 flex-1"
        />
      </div>

      <Input
        label="Value"
        data-create-field-value=""
        value={value}
        error={error}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" data-create-field-submit="" loading={busy} loadingLabel="Adding…">
          Add to profile and card
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <p className="text-xs text-ink-3">
        Saved to your profile, so every card can use it — and put on this card now.
      </p>
    </form>
  );
}

function RailButton({
  id,
  label,
  active,
  onSelect,
}: {
  id: RailId;
  label: string;
  active: boolean;
  onSelect: (id: RailId) => void;
}): ReactElement {
  return (
    <button
      type="button"
      data-add-field-category={id}
      aria-current={active ? "true" : undefined}
      onClick={() => onSelect(id)}
      className={cn(
        /* `min-h-9` gives the rail the same rhythm as the rows beside it, so the two columns
           read as one sheet rather than as a menu bolted to a list. Still a pill, still
           `shrink-0`: below `sm` these are a horizontally scrolling strip. */
        "flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-left text-sm",
        "transition-colors duration-[var(--dur-fast)] sm:w-full",
        active ? "bg-ink text-canvas" : "text-ink-3 hover:bg-surface-sunk hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

/**
 * One field, offered.
 *
 * Three columns, in the order the eye uses them: **what kind of thing it is** (the glyph),
 * **which one it is** (the label, and the value that tells two work numbers apart), and **the
 * one thing you can do to it**.
 *
 * The two states are **a button** and **not a button**. An already-added field renders as a
 * static "Added" marker rather than a disabled control: there is nothing to explain and nothing
 * to try, and a disabled button that can never re-enable from inside this dialog is a focus stop
 * that leads nowhere. Removal lives on the section's own list, beside the field, where the owner
 * is already looking at what the card carries.
 *
 * ⚠ **The row itself is not a control**, and gets no hover fill, for exactly that reason: only
 * part of it is clickable. A full-row fill on a row whose left two-thirds do nothing is a
 * promise the row cannot keep, and making the whole row the button is not available — an
 * *Added* row has no action at all, so half the list would be a button and half a `<div>` that
 * looked identical.
 */
function ResultRow({
  row,
  added,
  onAdd,
}: {
  row: BuilderFieldRow;
  added: boolean;
  onAdd: (fieldId: string) => void;
}): ReactElement {
  return (
    <li
      data-add-field-result={row.field.id}
      /* `[data-field-option="{id}"]` has always meant "a row for this field". It followed the
         *choosing* affordance here from the checkbox list. */
      data-field-option={row.field.id}
      data-add-field-added={added ? "" : undefined}
      className="flex items-center gap-3 border-b border-line py-3.5 last:border-b-0"
    >
      {/* The type glyph, from `FIELD_RENDERERS` by way of the row model — never a table in this
          file. `aria-hidden`, and the label beside it carries the meaning (§8.8, AC-25). The
          tile is what gives the list its left edge; an unrecognised type would render an empty
          one rather than collapsing the column and shifting every label on the row. */}
      <span
        data-add-field-result-icon=""
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunk text-ink-2"
      >
        {row.icon}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink">{row.field.label}</span>
          {row.masked ? <MaskedMarker sensitive={row.field.isSensitive} /> : null}
        </span>
        {/* Absent, not empty, when masked — the node itself must not exist. */}
        {row.display === null ? null : (
          <span
            data-add-field-result-value=""
            data-field-option-value=""
            className="truncate text-xs text-ink-3"
          >
            {row.display}
          </span>
        )}
      </div>

      {added ? (
        <span
          data-add-field-result-added=""
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface-sunk px-3.5 text-xs text-ink-3"
        >
          <Check aria-hidden="true" className="size-3.5" />
          Added
        </span>
      ) : (
        <button
          type="button"
          data-add-field-result-add={row.field.id}
          /* Named for the field, not "Add": a screen-reader user tabbing six identical "Add"
             buttons has no idea which field they are on (§8.8, AC-25). */
          aria-label={`Add ${row.field.label}`}
          onClick={() => onAdd(row.field.id)}
          className={cn(
            /* `min-h-9` — the pointer-target floor this sheet is used against with a thumb, and
               the same height as the tile opposite it, so the row has one baseline grid. */
            "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-line-control",
            "bg-surface px-3.5 text-sm text-ink transition-colors duration-[var(--dur-fast)]",
            "hover:bg-surface-sunk",
          )}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add
        </button>
      )}
    </li>
  );
}

/**
 * The marker on a row whose value this screen will not print.
 *
 * Two words rather than one because the two reasons are different: the owner marked this
 * sensitive, or the type is masked on every public surface whatever they marked. Both mean the
 * card will not show it in the clear, and neither is stated by the icon alone (§8.8).
 *
 * Exported so the section's own list marks a masked field identically — the two surfaces have to
 * agree about which fields are masked, and the cheapest way to guarantee that is to have them
 * render the same component.
 */
export function MaskedMarker({ sensitive }: { sensitive: boolean }): ReactElement {
  return (
    <span
      data-field-sensitive=""
      className="inline-flex items-center gap-1 rounded-full bg-surface-sunk px-2 py-0.5 text-xs text-ink-3"
    >
      <EyeOff aria-hidden="true" className="size-3" />
      {sensitive ? "Sensitive" : "Masked when shared"}
    </span>
  );
}
