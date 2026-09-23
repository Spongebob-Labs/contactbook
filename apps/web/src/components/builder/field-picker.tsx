"use client";

import { SquarePen } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactElement } from "react";

import { FIELD_CATEGORY_LABELS } from "@/components/app";
import { Checkbox } from "@/components/primitives";
import { cn } from "@/lib/cn";
import type { FieldGroup, ProfileField } from "@/types/domain";

import { MaskedMarker, NewFieldRow, type CreatedField, type FieldDraft } from "./field-sources";
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
 * ## ⚠ THE PANEL IS DRAWN IN HAIRLINES AND TYPE. IT USED TO BE DRAWN IN FILLS, AND THAT WAS
 * ##   REJECTED — 2026-09-20
 *
 * Client: *"the colour and gradients that you have added inside those fields or checkboxes are
 * not at all looking good… I don't like the golden color in between this. It could be just
 * something a little lighter."* Two filled objects produced that look and both are gone. Every
 * ratio below was computed with `contrastRatio` from `src/lib/contrast.ts` against the hexes in
 * `tokens.css` — none is estimated, and none is an old number carried forward.
 *
 *   · **The category header was a filled `bg-surface-sunk` bar.** `#F2EAE1` on the panel's
 *     `#FCFAF8` ground measures **1.14:1**. That is the defect stated as a number: a 1.14:1
 *     fill is far too weak to carry information and far too wide to go unnoticed, so seven of
 *     them down a 35-row list contribute nothing but beige. It is also the *widest* object in
 *     the panel, which is why a barely-there tint reads as "the golden color in between".
 *   · **A ticked row was a filled `bg-surface` block** (`#F7F2ED`, **1.07:1** on canvas) while
 *     an unticked one took `hover:bg-surface/60` (**1.04:1**). Two fills a third of a step
 *     apart, one of them applied by the pointer — so the list alternated beige and cream in a
 *     rhythm that changed every time somebody ticked something.
 *
 * What replaces them costs no fill at all:
 *
 *   · **One hairline per group.** `--line`, **1.23:1** on canvas — decorative by definition and
 *     exempt from 1.4.11, because it bounds nothing interactive. It is carried on the
 *     `<section>` and not on the `<h3>`, so `first:border-t-0` can drop it at the top of the
 *     list without a wrapper knowing whether the composer is above it.
 *   · **A quiet `--text-overline` label under it, in `--ink-2`** — **10.98:1** on `--canvas`,
 *     **10.64:1** on the hover wash. `--ink-3` is the system's usual label ink and is what the
 *     bar used; it is deliberately *not* used here. At `#816544` it is literally the gold the
 *     client named, and on the one object they pointed at, ink and fill were the same
 *     complaint.
 *   · **Nothing on a ticked row.** See below.
 *
 * ⚠ **`--ink-3` SURVIVES ON THE ROW VALUES AND THE FOOTNOTE, AND THAT IS A DECISION, NOT AN
 * OVERSIGHT.** It is the warmest ink left in this panel (**5.20:1** on canvas, **5.04:1** on
 * the hover wash — both past 4.5:1), so it is the first thing to look at if the client says
 * "still golden". It was kept because it is the product's caption ink *everywhere* — `/profile`,
 * `/contacts`, the dashboard — and repainting it in this one panel would answer "make it match"
 * (their words) by making this the only list in the app whose captions are a different colour.
 * If it does have to move, it moves in `tokens.css` for the whole product, with every ratio in
 * that file recomputed; it does not get a local override here.
 *
 * ⚠ The one fill left in the list is `hover:bg-surface/50` — `#FAF6F3`, **1.03:1** on canvas,
 * which is *under* the weight of the tint it replaces and under the weight of the old hover
 * too. It is feedback, never state: Tailwind v4 scopes `hover:` to `@media (hover: hover)`, so
 * it never latches on a phone, and nothing in this panel is legible only while it is applied.
 *
 * ## ⚠ A TICK IS THE BOX AND THE INK, AND IT MUST SURVIVE GREYSCALE
 *
 * The tint is gone and the note that defended it — *"in a 35-row list the checkbox alone is a
 * 16px signal"* — was only ever half true. A ticked row carries four signals and three of them
 * are not colour:
 *
 *   1. the box is **filled** `--accent` (`#0D1C25`, **16.67:1** on canvas) where an unticked
 *      one is an empty `--line-control` outline (**3.77:1**, clearing 1.4.11's 3:1 for a
 *      control boundary);
 *   2. it carries a **✓ glyph** — a shape, which is what makes the state readable with colour
 *      removed entirely (1.4.1);
 *   3. the label goes `font-medium` `--ink` (**20.03:1**) where an unticked one is `--ink-2`
 *      (**10.98:1**) — a weight change as well as a tone change;
 *   4. the row **grows**: an editable row gains its value input, a masked one gains its way out
 *      to `/profile`.
 *
 * A fill was the fourth-weakest of five signals and the only one anybody objected to.
 *
 * ## ⚠ MOBILE IS THE CASE THIS PANEL IS SIZED FOR — 360–430px
 *
 * Client, twice, and called crucial: *"from the perspective of the mobile users, that this
 * thing is compatible enough to just use."* Four things hold it there:
 *
 *   · **The row is ≥44px on touch** (`max-md:min-h-11`), so the checkbox's own 44px hit region
 *     (`TOUCH_HIT_44`, ±12px around a 20px box) is *contained by its row* rather than reaching
 *     into the rows above and below it, where the later sibling would win the overlap and steal
 *     taps aimed at the row before it.
 *   · **The label is a real `<label htmlFor>`**, so the row's text is the tap target and not
 *     just decoration beside one — see the ⚠ on `tickId` in `FieldRow`.
 *   · **Nothing overflows sideways.** The label truncates, the value truncates, and under 22rem
 *     of column the value drops to its own full-width line instead of squeezing the label. The
 *     panel is ~324px at a 360px viewport, so that is the *resting* shape on a phone, not an
 *     edge case — see the container-query note on the root.
 *   · **The category header is deliberately NOT sticky**, and could not be without undoing this
 *     change. `[data-field-list-card]` is `overflow-hidden`, which makes it the nearest
 *     scrollport — a sticky child of a box that never scrolls never sticks. Below `lg` the
 *     document scrolls while `[data-split-pinned]` holds the top `--builder-preview-h` of the
 *     viewport, so a header stuck to the viewport top would stick *behind* the pinned preview.
 *     And a sticky header has to be opaque or the rows scroll through it — which is the filled
 *     bar, back again, for a panel short enough that the label is rarely off screen.
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
  onCreateField?: (draft: FieldDraft) => Promise<CreatedField | null>;
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
            /**
             * ⚠ **It stays OPEN after a successful add, and that is a change.**
             *
             * It used to `setComposing(false)` — one add, composer closed, reopen to add another.
             * That made "add my three socials" into three round trips through a collapsed row,
             * which is the shape of the client's *"very headache for the person to add"*.
             *
             * `NewFieldRow` returns itself to the chooser with the category still selected, so
             * the next thing is one tap away. Nothing is lost by not closing: what confirms the
             * add was never the composer collapsing — it is the field appearing on the card in
             * the pinned preview, in the same frame, plus the toast `builder-client.tsx` raises.
             * The close control is right there and the row is one line when closed.
             */
            onCreate={onCreateField}
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
              <section
                key={section.category}
                data-field-group={section.category}
                /* ⚠ THE GROUP'S RULE LIVES HERE, NOT ON THE `<h3>`, AND `first:` IS WHY.
                   The divider between two groups is one hairline, and the top of the list must
                   not have one — the card's own border is already there, and above the first
                   group there is either that border or the composer's own `border-b`. Put on
                   the heading, "is this the first group?" would need a prop threaded down from
                   the map; put on the section, it is `:first-child` and the DOM answers it. */
                className="border-t border-line first:border-t-0"
              >
                {/* ⚠ An `<h3>`, and the level is not cosmetic: the panel's `<h2>` is the
                    `sr-only` section name in `panel-head.tsx`, so these are its children and
                    the outline runs 1 → 2 → 3 with nothing skipped. It used to be an `<h4>`
                    under the deleted column heading.

                    ⚠ NO FILL. It was `bg-surface-sunk` — 1.14:1 on canvas, the beige band the
                    client rejected. The category now reads as a divider the way a divider
                    should: a rule, then a label set small, uppercase and tracked. That is what
                    `--text-overline` is for (11px / 0.08em, `tokens.css`), used by name so the
                    tracking is not re-guessed here in an arbitrary value.
                    `--ink-2` on `--canvas` measures 10.98:1 — see the ⚠ in the module note for
                    why this label is the one place `--ink-3` is refused. */}
                <h3 className="px-4 pb-1 pt-3 text-overline font-medium uppercase text-ink-2">
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
  /**
   * ⚠ **THE TICK GETS AN ID SO THE ROW'S TEXT CAN BE A `<label htmlFor>`, AND ON A PHONE THAT
   * IS THE DIFFERENCE BETWEEN A USABLE ROW AND A 20px SQUARE.**
   *
   * `Checkbox` is given `hideLabel` here, which takes its own label out of the layout — and that
   * label is the thing that normally makes the *text* tappable. Without this the only target on
   * the row was the drawn box: 20px, with `TOUCH_HIT_44` around it, on a row whose other ~280px
   * did nothing when a thumb landed on it. A finger aims at the word, not at the square.
   *
   * A `<label for>` rather than an `onClick` because `Checkbox`'s root is a Radix
   * `<button role="checkbox">`, and `<button>` is a labelable element — so the browser forwards
   * the activation with no handler, no `cursor` guesswork and no keyboard regression. The
   * primitive documents the same mechanism for its own visible label.
   *
   * ⚠ The accessible name does NOT change: the root keeps `aria-labelledby` pointing at the
   * primitive's `sr-only` label ("Share Mobile on this card"), which outranks any `<label for>`
   * in the accname computation. 2.5.3 Label in Name still holds, because the spoken name
   * contains the visible one — "Share **Mobile** on this card" — and it holds in that direction
   * only, so do not "simplify" the hidden label to something the row does not print.
   */
  const tickId = `builder-tick-${row.field.id}`;
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
        /* ⚠ 44px ON TOUCH. An unticked row is one 20px box beside one 13px line — about 36px
           tall with its padding, and `TOUCH_HIT_44` then grows the box's hit region ±12px,
           i.e. 4px PAST the row on each side and into its neighbours. Overlapping regions are
           resolved by paint order, so the row below would quietly take taps aimed at the
           bottom of the row above. The floor is what keeps each region inside its own row; it
           costs nothing above `md`, where the pointer is precise and the list stays dense. */
        "max-md:min-h-11",
        /* Every row carries the rule; `last:` drops it on the last row OF ITS GROUP, where the
           next `<section>`'s `border-t` takes over — and on the final row of the list, where
           the card's own border is already drawn. One hairline at every boundary, never two. */
        "border-b border-line last:border-b-0",
        "transition-colors duration-[var(--dur-fast)]",
        /* ⚠ NO FILL ON A TICKED ROW — see the module note. The tick is the filled box, the ✓
           glyph, the label's weight and the row's own growth; a 1.07:1 tint was the weakest of
           the five and the only one anybody complained about. What is left is hover feedback at
           1.03:1, applied to EVERY row so it can never be mistaken for state, and scoped by
           Tailwind v4 to `(hover: hover)` so it never latches under a thumb. */
        "hover:bg-surface/50",
      )}
    >
      {/* ⚠ `hideLabel`, so this component owns the row's layout rather than the primitive's
          label/description stack. That stack is what forced the value under the label and left
          most of a 498px row empty — the "sparse and unstyled" the client saw. */}
      <Checkbox
        id={tickId}
        checked={on}
        onCheckedChange={(next) => onToggle(next === true)}
        data-field-tick={row.field.id}
        hideLabel
        label={`Share ${row.field.label} on this card`}
        rowClassName="shrink-0"
      />

      <span className="flex min-w-0 flex-1 items-center gap-2">
        <label
          htmlFor={tickId}
          className={cn(
            "min-w-0 flex-1 cursor-pointer truncate text-sm",
            /* ⚠ THE STATE, IN INK AND WEIGHT — the half of the tick that is not the checkbox.
               `--ink` measures 20.03:1 on `--canvas` and 19.41:1 on the hover wash; `--ink-2`
               10.98:1 and 10.64:1. Both clear 4.5:1 with room to spare, and the `font-medium`
               step means the difference is still there when colour is not. */
            on ? "font-medium text-ink" : "text-ink-2",
            /* 44px of label on touch, and none of it in the flow: `py-3` grows the hit box by
               12px a side and `-my-3` gives the same 12px back to the flex line, so the row's
               height and the list's rhythm are untouched. The same trick the `text-link`
               button variant uses, and `mobile-contracts.test.tsx` pins it there. */
            "max-md:-my-3 max-md:py-3",
          )}
        >
          {row.field.label}
        </label>
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
            /* ⚠ THE BOUNDARY IS THE ONLY THING THAT SAYS "THIS IS A BOX YOU CAN TYPE IN", now
               that the row behind it has no fill of its own: `bg-canvas` on `--canvas` is the
               same colour. `--line-control` measures 3.77:1 on canvas and 3.65:1 on the hover
               wash, so it clears 1.4.11's 3:1 for a control boundary on both. `--line` here
               would be 1.23:1 and is what `tokens.css` warns about by name. */
            "w-full min-w-0 rounded-md border border-line-control bg-canvas px-2 py-1.5",
            "text-sm text-ink placeholder:text-ink-4",
            "transition-colors duration-[var(--dur-fast)]",
            /* ⚠ `focus:border-accent` (16.67:1), NOT the `focus:border-ink-4` this used to
               carry. `--ink-4` is 2.53:1 — the focus border was *lighter* than the resting one
               and under the non-text floor, so focusing the control weakened the only boundary
               it had. The global `:focus-visible` ring in `globals.css` is what actually
               announces focus; this just stops the box fading while it is announced. */
            "focus:border-accent focus:outline-none",
            "@min-[22rem]/list:w-[46%] @min-[22rem]/list:shrink-0",
            BUILDER_SCROLL_CLEAR,
          )}
        />
      ) : row.display === null ? null : (
        <span
          data-field-row-value=""
          data-field-option-value=""
          className={cn(
            /* `--ink-3` keeps its documented job here — this is a caption, not a heading —
               and measures 5.20:1 on `--canvas`, 5.04:1 on the hover wash, both past 4.5:1.
               `truncate` is load-bearing on a phone: a 45-character work email is ~337px in a
               ~296px column, and without it the whole document scrolls sideways. */
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
            /* ⚠ A REAL 44px HERE, not a hit box borrowed from the flow. This link takes its own
               line under the pair, so growing it costs height on ticked masked rows only — and
               those are the rows where a mis-tap sends somebody hunting for a value they are
               not allowed to see. A `-my-*` trick would instead reach up into the label's own
               target 6px above it, and the later sibling wins that overlap. `--ink-2` under the
               underline measures 10.98:1 on canvas. */
            "max-md:min-h-11",
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
