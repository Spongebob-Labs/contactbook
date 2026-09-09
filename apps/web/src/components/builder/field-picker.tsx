"use client";

import { SquarePen } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactElement } from "react";

import { FIELD_CATEGORY_LABELS } from "@/components/app";
import { Checkbox } from "@/components/primitives";
import { cn } from "@/lib/cn";
import type { FieldGroup, FieldType, ProfileField } from "@/types/domain";

import { MaskedMarker, NewFieldRow, type CreatedField } from "./field-sources";
import { FIELD_CATEGORY_ORDER, buildFieldRows, type BuilderFieldRow } from "./field-rows";
import { BUILDER_SCROLL_CLEAR } from "./scroll-clear";

/**
 * The **Fields** section — a card is a *filter over the owner's profile*, and this is the filter.
 *
 * ## ⚠ FOURTH LAYOUT. THE THREE BEFORE IT BROKE ONE OF TWO RULES, AND THE RULES ARE THE DESIGN.
 *
 *     1. Tapping a field must change only that row, in place.
 *     2. Nothing on this panel may cost attention unless it is the work.
 *
 * · **A modal** (`add-field-dialog.tsx`, deleted). The result of an add was behind an overlay
 *   sitting on top of the very preview it changed. Client: *"why it opens a pop-up?"*
 * · **Two columns below the card's own field list** (deleted). Worse, and measurably: the panel
 *   is itself `overflow-y-auto`, and the offer list added a second `max-h-[22rem] overflow-y-auto`
 *   **inside** it — a scrollbar in a scrollbar. With eight fields on the card the add controls
 *   began ~970px down, and pressing `+` moved the row ~900px above the finger, off screen.
 *   Client: *"the user will be scrolling up and up… he has to scroll down and go on to the new
 *   field."*
 * · **A ticked list beside a permanent "Add a new field" column** — rule 1 fixed, rule 2 broken.
 *   Standing open beside the list, every time the panel opened, were: a search box over the
 *   profile, a titled column head, a labelled **Kind** select, a labelled **Value** box, a submit
 *   and a sentence explaining them — six objects for the two things an owner does *rarely*, taking
 *   a third of the panel's width from the list, which is what they do *always*. Client, 2026-09-07:
 *   *"still quite noisy. I would remove the kind and the value. Also remove the search bar."*
 *
 * ⚠ The argument for that third layout — "two headed columns make the screen self-describing" —
 * is the trap worth recording: it is true of a screen read once and false of a screen used daily.
 * Self-describing is what the panel's **one sentence of intro** is for. Standing controls up to
 * describe themselves charges the frequent case for the rare one.
 *
 * ## What this is now: one list, ticked, with the composer as its first row
 *
 *     ┌ + New field ─────────────────────────────────────┐   ← one row until asked for
 *     ├──────────────────────────────────────────────────┤
 *     │ PERSONAL                                          │
 *     │ ☑ Mobile              +91 99532 66232             │
 *     │ ☐ Home address        Alpha 2, Greater Noida       │
 *     │ WORK                                              │
 *     │ ☑ Job title           [ SDE                     ] │
 *     └──────────────────────────────────────────────────┘
 *     Values come from your profile — editing one changes it on every card that uses it.
 *
 * Five properties, each answering one of the defects above:
 *
 *   · **Travel is zero.** There is no "add control" to reach: the row you are looking at is the
 *     control. Its position cannot depend on the field count, because there is only one list.
 *   · **⚠ NOTHING RE-SORTS ON TICK.** Stable profile order, always — see {@link ordered}. The
 *     tick changes and the row stays under the finger. Sorting ticked rows to the top would
 *     reintroduce the whole bug in miniature: tap a field, watch it leap somewhere else.
 *   · **One scroll container.** The panel's. The nested scroller went with the list it belonged
 *     to.
 *   · **⚠ No search.** Deleted on the client's instruction and it was the right call on the
 *     numbers: a profile is *tens* of fields grouped under seven category bands, not hundreds,
 *     so scanning is scanning and not hunting — and the box was the heaviest object in the
 *     column, above the list it filtered. `rowMatches` survives in `field-rows.ts` for a surface
 *     that genuinely lists hundreds; nothing here calls it.
 *   · **The card's own field list is gone, and its absence is the point.** It restated, in
 *     ~105px per row, exactly what `<BuilderPreview>` renders beside it — Address, SDE and
 *     Business appeared twice on one screen — and that duplication is what pushed everything
 *     else past the fold. The preview answers "what does this card share?"; this list answers
 *     "what could it?".
 *
 * ## ⚠ This component no longer renders the panel's head
 * The head is the **card's name**, and it is rendered once by `builder-client.tsx` above the tab
 * panels — because Radix keeps every `Tabs.Content` mounted, so a head per panel would put two
 * `[data-builder-name]` inputs in the document. See `panel-head.tsx`.
 *
 * ## ⚠ The tick renders on the card immediately, and that is not this component's doing
 * `onToggle` reaches `builder-client.tsx`'s `toggleField`, which dispatches into the reducer
 * **synchronously** — `state.fieldIds` → `builderCard(state)` → `resolveCard(...)` →
 * `<BuilderPreview>`. The API write that follows is fire-and-forget and the UI never waits on
 * it. So the field appears on the card in the same frame as the tick, offline included, and
 * `builder.spec.ts` asserts exactly that rather than trusting it.
 *
 * ## Reordering is deliberately not supported
 * Confirmed with the client, 2026-09-03. It is the one thing a profile-ordered list makes
 * harder: card order lives in `state.fieldIds` and is visible in the preview, but there is no
 * handle to drag here. If it is ever wanted, this list is the wrong home for it — a short "on
 * this card" strip above the list would be, and that is a different change.
 */
export interface FieldPickerProps {
  groups: readonly FieldGroup[];
  fields: readonly ProfileField[];
  /** The ids currently on the card. Drives every tick. */
  selected: readonly string[];
  onToggle: (fieldId: string, on: boolean) => void;
  /**
   * One field's value, as typed. Live — there is no per-row commit, and see the ⚠ in
   * `FieldRow` for why there must not be one.
   */
  onEditValue: (fieldId: string, value: string) => void;
  /**
   * Create a profile field and put it on this card.
   *
   * Optional so a surface with no API to write to can omit it; the composer row is then absent
   * rather than present and broken.
   */
  onCreateField?: (draft: {
    type: FieldType;
    label: string;
    value: string;
  }) => Promise<CreatedField | null>;
  /** True while that create is in flight. */
  creatingField?: boolean;
}

export function FieldPicker({
  groups,
  fields,
  selected,
  onToggle,
  onCreateField,
  creatingField = false,
  onEditValue,
}: FieldPickerProps): ReactElement {
  const [composing, setComposing] = useState(false);

  const rows = useMemo(() => buildFieldRows(groups, fields), [groups, fields]);
  const chosen = useMemo(() => new Set(selected), [selected]);

  /**
   * ⚠ THE PROFILE'S OWN ORDER, AND IT MUST NOT DEPEND ON `selected`.
   *
   * `buildFieldRows` already returns rows in the profile's display order. Nothing here re-sorts
   * by ticked-ness, and `selected` is deliberately absent from this memo's inputs — so a tick
   * cannot move a row. That is the rule in the module note, expressed as a dependency array.
   */
  const ordered = useMemo(
    () =>
      FIELD_CATEGORY_ORDER.map((category) => ({
        category,
        rows: rows.filter((row) => row.category === category),
      })).filter((section) => section.rows.length > 0),
    [rows],
  );

  const empty = rows.length === 0;

  return (
    /**
     * ⚠ `@container`, NOT A VIEWPORT BREAKPOINT — AND THE MEASUREMENTS SAY SO.
     *
     * This panel sits inside `SplitView`'s content column, beside a 400px pinned preview and
     * after a nav rail, so its width has almost no relationship to the viewport's. Measured:
     *
     *     viewport   390   768  1024  1280  1440  1920
     *     panel      324   654   374   630   790  1014
     *
     * **1024 is narrower than 768** — that is where the split view turns on and hands 400px to
     * the preview. No `lg:` / `xl:` rule can express "wide at 768, narrow at 1024, wide at
     * 1280"; a viewport breakpoint would put the change at the single narrowest width in the
     * whole range. The list is one column at every width now, so what the container query still
     * decides is the shape of a *row* — see `FieldRow`.
     */
    <div data-field-picker="" className="@container/picker flex flex-col gap-2.5">
      <section
        data-field-list-card=""
        /* Named rather than headed. A visible "Existing profile fields" title restated the
           panel's own intro one line above it; the accessible name says the same thing to a
           screen reader for nothing. */
        aria-label="Your profile fields"
        className={cn(
          "@container/list flex min-w-0 flex-col overflow-hidden rounded-xl border border-line",
        )}
      >
        {/* ⚠ FIRST ROW OF THE LIST, CLOSED. Anchored to the top so its distance from the
            reader cannot grow with the field count — the defect the client reported twice. */}
        {onCreateField === undefined ? null : (
          <NewFieldRow
            open={composing}
            onOpenChange={setComposing}
            creating={creatingField}
            onCreate={async (draft) => {
              const created = await onCreateField(draft);
              if (created !== null) setComposing(false);
              return created;
            }}
          />
        )}

        {empty ? (
          <div data-field-picker-empty="" className="flex flex-col items-start gap-2 px-4 py-6">
            <p className="text-sm text-ink">Your profile has no fields yet.</p>
            <p data-prose className="text-xs text-ink-3">
              A card shares fields from your profile.{" "}
              <span className="text-ink">New field</span> makes one and ticks it onto this card at
              the same time.
            </p>
          </div>
        ) : (
          <div data-field-list="" className="flex flex-col">
            {ordered.map((section) => (
              <section key={section.category} data-field-group={section.category}>
                {/* ⚠ An `<h3>`, and the level is not cosmetic: the panel's `<h2>` is the
                    `sr-only` section name in `panel-head.tsx`, so these are its children and
                    the outline runs 1 → 2 → 3 with nothing skipped. It used to be an `<h4>`
                    under the deleted column heading. Set quiet, on a tinted band, so the
                    category reads as a divider rather than as a title. */}
                <h3 className="bg-surface-sunk px-4 py-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-ink-3">
                  {FIELD_CATEGORY_LABELS[section.category]}
                </h3>
                <ul className="flex flex-col">
                  {section.rows.map((row) => (
                    <FieldRow
                      key={row.field.id}
                      row={row}
                      on={chosen.has(row.field.id)}
                      onToggle={(next) => onToggle(row.field.id, next)}
                      onEditValue={(value) => onEditValue(row.field.id, value)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      {/* ⚠ The one thing the intro used to say and no longer does — moved out of the head and
          under the list, because it is a *consequence* of editing a value rather than an
          instruction for choosing fields, and the head is now the card's name. One line, after
          the object it is about, which is where a footnote belongs. */}
      {empty ? null : (
        <p data-field-picker-note="" data-prose className="px-1 text-xs text-ink-3">
          Values come from your profile — editing one changes it on every card that uses it.
        </p>
      )}
    </div>
  );
}

/* ── one row ─────────────────────────────────────────────────────────────────── */

function valueNote(row: BuilderFieldRow, value: string): string | null {
  if (value.trim() === "") {
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

/**
 * A field, and whether this card shares it.
 *
 * ## ⚠ THE VALUE EDITOR APPEARS ONLY ON A TICKED ROW
 * A row you are not sharing does not need an input, and 35 inputs on one panel is what made the
 * old rows ~105px tall. Ticked rows get the editor; unticked rows print the value and stay
 * short. That is the whole of the height saving, and it also means the editable surface is
 * exactly the set of things that reach the card.
 *
 * ⚠ There is no per-row commit and there must not be one. The value is the profile's, shared by
 * every card that maps it, and `onEditValue` is live into the reducer so the preview keeps up
 * with the keystroke. A Save button here would imply this one card owns the value.
 */
function FieldRow({
  row,
  on,
  onToggle,
  onEditValue,
}: {
  row: BuilderFieldRow;
  on: boolean;
  onToggle: (next: boolean) => void;
  onEditValue: (value: string) => void;
}): ReactElement {
  const inputId = `builder-field-${row.field.id}`;
  const noteId = `${inputId}-note`;
  const note = on && row.editable ? valueNote(row, row.field.value) : null;

  return (
    <li
      data-field-row={row.field.id}
      /* ⚠ Kept from every previous layout: `builder.spec.ts` and the field-row helpers address
         a row by these, and renaming them would silently orphan those selectors. */
      data-field-option={row.field.id}
      data-field-on={on ? "" : undefined}
      data-field-editable={row.editable ? "" : undefined}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2",
        "border-b border-line last:border-b-0",
        "transition-colors duration-[var(--dur-fast)]",
        /* Ticked rows are tinted. In a 35-row list the checkbox alone is a 16px signal; a row
           tint is what makes "what is on this card?" answerable at a glance. */
        on ? "bg-surface" : "hover:bg-surface/60",
      )}
    >
      {/* ⚠ `hideLabel`, so this component owns the row's layout rather than the primitive's
          label/description stack. That stack is what forced the value under the label and left
          most of a 498px row empty — the "sparse and unstyled" the client saw. */}
      <Checkbox
        checked={on}
        onCheckedChange={(next) => onToggle(next === true)}
        data-field-tick={row.field.id}
        hideLabel
        label={`Share ${row.field.label} on this card`}
        rowClassName="shrink-0"
      />

      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className={cn("truncate text-sm", on ? "font-medium text-ink" : "text-ink-2")}>
          {row.field.label}
        </span>
        {row.masked ? <MaskedMarker sensitive={row.field.isSensitive} /> : null}
      </span>

      {/*
        ⚠ THE VALUE SITS ON THE ROW'S RIGHT, NOT UNDER THE LABEL.
        A `@container/list` query, not a viewport one: this column is ~300px inside a narrow
        panel and ~500px inside a wide one, at the same viewport. Below 22rem of column the
        value takes its own line (`w-full`); above it, it shares the row and the list reads as
        a table of label/value pairs instead of a stack of two-line blocks.
      */}
      {on && row.editable ? (
        <input
          id={inputId}
          type="text"
          data-field-row-input={row.field.id}
          value={row.field.value}
          onChange={(event) => onEditValue(event.target.value)}
          aria-label={`${row.field.label} value`}
          aria-describedby={note === null ? undefined : noteId}
          spellCheck={false}
          autoComplete="off"
          className={cn(
            "w-full min-w-0 rounded-md border border-line-control bg-canvas px-2 py-1.5",
            "text-sm text-ink placeholder:text-ink-4",
            "transition-colors duration-[var(--dur-fast)]",
            "focus:border-ink-4 focus:outline-none",
            "@min-[22rem]/list:w-[46%] @min-[22rem]/list:shrink-0",
            BUILDER_SCROLL_CLEAR,
          )}
        />
      ) : row.display === null ? null : (
        <span
          data-field-row-value=""
          data-field-option-value=""
          className={cn(
            "block w-full min-w-0 truncate text-xs text-ink-3",
            "@min-[22rem]/list:w-[46%] @min-[22rem]/list:shrink-0 @min-[22rem]/list:text-right",
          )}
        >
          {row.display}
        </span>
      )}

      {/* Only a ticked, non-editable row needs the way out to `/profile`, and only a ticked
          editable one can have a note. Both take their own line under the pair. */}
      {on && !row.editable ? (
        <Link
          href="/profile"
          data-field-edit-elsewhere={row.field.id}
          className={cn(
            "inline-flex w-full items-center gap-1.5 text-xs text-ink-2 underline underline-offset-4",
            "@min-[22rem]/list:w-auto",
          )}
        >
          <SquarePen aria-hidden="true" className="size-3.5" />
          {row.masked ? "Change it in your profile" : "Edit in your profile"}
        </Link>
      ) : null}

      {note === null ? null : (
        <span
          id={noteId}
          data-field-row-note={row.field.id}
          role="status"
          className="w-full text-xs text-ink-2"
        >
          {note}
        </span>
      )}
    </li>
  );
}
