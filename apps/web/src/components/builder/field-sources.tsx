"use client";

import { ArrowLeft, EyeOff, Plus, X } from "lucide-react";
import { useId, useState, type ReactElement } from "react";

import { Button, Input, TOUCH_HIT_44_Y } from "@/components/primitives";
import { cn } from "@/lib/cn";
import type { ApiFieldCategory } from "@/lib/api/schema";
import type { FieldType } from "@/types/domain";

import { FIELD_CATALOGUE, type FieldOffer } from "./field-catalogue";
import { BUILDER_SCROLL_CLEAR } from "./scroll-clear";

/**
 * The two small parts of the Fields panel: the marker a masked row wears, and the one-line
 * composer that authors a field the profile does not have yet. The ticked list itself is in
 * `field-picker.tsx`.
 */

/** What a successful create produced, so the caller can report where it landed. */
export interface CreatedField {
  fieldId: string;
  category: string;
}

/** What the composer hands up when the owner presses Add. */
export interface FieldDraft {
  type: FieldType;
  label: string;
  value: string;
  /**
   * ⚠ **Chosen, not inferred — this property is the point of the redesign.**
   *
   * It used to be derived from `type` by `CATEGORY_FOR_QUICK_TYPE` in `builder-client.tsx`, so
   * every `PHONE` became `PERSONAL` and a work mobile landed in the wrong section of the card.
   * The owner now picks the category first and the field is filed where they put it.
   */
  category: ApiFieldCategory;
}

/**
 * The label a masked row wears.
 *
 * ⚠ `shrink-0` and `whitespace-nowrap` are load-bearing on a phone. This pill is a flex item in
 * a row whose text column is about 105px at 320px, while "Masked when shared" needs ~142px. A
 * flex item's `min-width` is `auto`, so instead of overflowing it shrank and wrapped its own
 * label across two lines *inside a `rounded-full`* — a broken pill silhouette that reads as a
 * rendering fault rather than a label. The row already wraps, so the pill takes its own line
 * when there is no room beside the label.
 *
 * ⚠ **OUTLINED, NOT FILLED — 2026-09-20.** It was `bg-surface-sunk`, the same `#F2EAE1` band
 * the category headers wore and the same thing the client rejected: *"I don't like the golden
 * color in between this."* At 1.14:1 on `--canvas` the fill carried no information the words
 * inside it do not; a `--line` hairline (1.23:1, decorative — this is a label, not a control,
 * so 1.4.11 does not reach it) keeps the pill silhouette for a tenth of the weight. The text
 * stays `--ink-3`: 5.20:1 on `--canvas`, 5.04:1 on the row's hover wash, both past 4.5:1.
 */
export function MaskedMarker({ sensitive }: { sensitive: boolean }): ReactElement {
  return (
    <span
      data-field-sensitive=""
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-xs text-ink-3"
    >
      <EyeOff aria-hidden="true" className="size-3" />
      {sensitive ? "Sensitive" : "Masked when shared"}
    </span>
  );
}

/**
 * **Author a field the profile does not have yet — category first, then the thing.**
 *
 * ## ⚠ FIFTH SHAPE. FOUR BEFORE IT WERE REJECTED, AND FOR DIFFERENT REASONS EACH TIME
 *
 * · **A modal** (`add-field-dialog.tsx`, deleted) — the result of an add sat behind an overlay
 *   on top of the very preview it changed. Client: *"why it opens a pop-up?"*
 * · **Two columns below the card's own field list** (deleted) — the add controls began ~970px
 *   down a panel that scrolled inside a panel.
 * · **A permanent headed column** with a labelled Kind select over a labelled Value box. Client,
 *   2026-09-07: *"still quite noisy. I would remove the kind and the value."*
 * · **A one-line composer: `[ Kind ▾ ] [ value ] [ Add ]`.** Quiet, reachable, in place — and it
 *   asked the wrong question. `Kind` was a flat list of eight `FieldType`s, which is the schema
 *   showing through the screen: nobody adding their LinkedIn thinks "I need a SOCIAL_LINK".
 *   Client, 2026-09-18: *"right now it is very headache for the person to add… we should give
 *   the addition of the fields as per Personal, Work, Social and some more kind of categories."*
 *
 * ## What it is now — two taps, in place, never more than three rows tall
 *
 *     ┌ + New field ────────────────────────────────────┐   ← closed: one row, ~40px
 *
 *     ┌ Personal · Work · Business · Social · Payment ·… ┐   ← open, step 1: pick a place
 *     │ [Mobile] [Email] [Home address] [Landline] …     │     …then pick a thing
 *     │ Saved to your profile and ticked onto this card. │
 *
 *     ┌ ← Mobile                                    [✕] ┐   ← step 2: one box, one button
 *     │ [ +91 98201 15577            ]        [ Add ]    │
 *     │ Saved to your profile and ticked onto this card. │
 *
 * **Every property the four rejections bought is kept**, and this is the part to check before
 * changing anything here:
 *
 *   · **Closed is still the resting state, still one row.** The panel opens on a list of fields
 *     and nothing else.
 *   · **Still the FIRST row of the list**, so its position cannot depend on the field count —
 *     the defect reported twice as *"the user will be scrolling up and up"*.
 *   · **Still in place. No overlay, nothing that covers the preview** it is about to change.
 *   · **Still no standing form.** Step 1 is chips; the labelled box appears only once there is
 *     something to type into. The accessible names stay on every control — `hideLabel` and
 *     `aria-label` — because AC-25 sweeps every route with axe.
 *   · **Still nothing re-sorts.** The created field lands in profile order wherever that falls;
 *     what confirms the add is the card in the pinned preview, plus the toast.
 *
 * ## ⚠ Why two steps rather than one longer row
 *
 * A one-row `[ category ▾ ] [ thing ▾ ] [ value ] [ Add ]` was the obvious cheaper answer and it
 * is worse: four controls on a panel that is ~324px wide at 360px, which is exactly the crowding
 * the third layout was rejected for. Replacing the step in place costs no height at all — the
 * composer is the same three rows in both states — and it means the owner is only ever answering
 * one question at a time.
 *
 * The category is remembered across adds within a session (`category` state below), because the
 * common case is adding two or three things from the same place at once.
 */
export function NewFieldRow({
  open,
  onOpenChange,
  onCreate,
  creating,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreate: (draft: FieldDraft) => Promise<CreatedField | null>;
  creating: boolean;
}): ReactElement {
  /* ⚠ The index, not the category id, because the first section is the default and this file
     must not restate which one that is. */
  const [sectionIndex, setSectionIndex] = useState(0);
  const [offer, setOffer] = useState<FieldOffer | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();

  const section = FIELD_CATALOGUE[sectionIndex] ?? FIELD_CATALOGUE[0];

  /** Back to step 1, keeping the category — the owner chose it and is still in it. */
  function clearOffer(): void {
    setOffer(null);
    setValue("");
    setError(null);
  }

  function close(): void {
    onOpenChange(false);
    clearOffer();
  }

  return (
    <div
      data-field-new=""
      data-field-new-open-state={open ? "open" : "closed"}
      data-field-new-step={!open ? "closed" : offer === null ? "choose" : "value"}
      className={cn(
        /* ⚠ **NO FILL, AND FOR THE REASON THIS ROW ALWAYS GAVE.** It used to be `bg-surface`,
           justified as *"the same band the group labels sit on, so the row reads as part of the
           list rather than as a widget parked on top of it."* The group labels no longer sit on
           a band — the client rejected it on 2026-09-20 — so keeping the fill here would have
           inverted the very argument for it and made the composer the one tinted block in a
           list drawn entirely in hairlines. It belongs to the list, so it is drawn like the
           list: canvas, with the same `--line` rule under it that divides every group. */
        "flex flex-col gap-2 border-b border-line px-3 py-2",
        "@container/new",
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {!open ? null : offer === null ? (
          /* ── step 1: where does it go, and what is it ─────────────────────────────── */
          <div data-field-choose="" className="flex min-w-0 flex-1 flex-col gap-2">
            {/* ⚠ A `radiogroup`, not a row of buttons. Six chips where exactly one is chosen is
                a radio group by definition, and typing it as one gives arrow-key navigation and
                a spoken "2 of 6" for free. `tablist` was the other candidate and is wrong: these
                do not switch panels, they filter one list. */}
            {/* ⚠ `gap-y-2.5` IS SET BY THE HIT REGIONS, NOT BY THE LOOK.
                `TOUCH_HIT_44_Y` grows each chip's pointer region 10px above and below a ~26px
                pill — 46px, with the painted pill untouched. These chips wrap onto two lines at
                360px, and at the old `gap-1` (4px) each line's region reached **6px into the
                other line's drawn pill**. Overlaps resolve by paint order, so the later chip
                wins: a tap on the top edge of a chip in line 2 opened it, but a tap on the
                bottom edge of the chip above it opened line 2's as well. At a 10px gap the two
                regions share only the gap and neither reaches a pill. Sideways spill is
                impossible by construction — the constant pins `inset-x-0`. */}
            <div
              role="radiogroup"
              aria-label="Field category"
              className="flex min-w-0 flex-wrap gap-x-1 gap-y-2.5"
            >
              {FIELD_CATALOGUE.map((entry, index) => {
                const active = index === sectionIndex;
                return (
                  <button
                    key={entry.category}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-field-category={entry.category}
                    onClick={() => setSectionIndex(index)}
                    className={cn(
                      "inline-flex items-center justify-center rounded-full border px-2.5 py-1",
                      "text-xs transition-colors",
                      /* 44px in the other axis too. "X" is a one-character offer and "Fax" a
                         three-character one — `px-2.5` leaves them ~28px wide, under the floor
                         on the one axis a `-inset-y` cannot help. */
                      "max-md:min-w-11",
                      TOUCH_HIT_44_Y,
                      BUILDER_SCROLL_CLEAR,
                      /* ⚠ THE CHOSEN CHIP IS `--accent`, THE SAME FILL AS A TICKED CHECKBOX.
                         It was `bg-ink` — a second "this one is chosen" colour on a panel that
                         already has one, and `--accent` is what `tokens.css` reserves for the
                         single deliberate exception where the chrome may be dark. White on it
                         measures 17.36:1; the fill on `--canvas` 16.67:1.

                         ⚠ The unchosen chip was `bg-surface-sunk` — the rejected beige, one per
                         category, six of them stacked above the list. It is an outline now, and
                         the outline is `--line-control` (3.77:1 on canvas) rather than `--line`
                         (1.23:1) because this is a CONTROL boundary: 1.4.11 asks 3:1 for the
                         thing that says where the button is, and `tokens.css` names `--line` as
                         the value that fails it. `--ink-2` on canvas is 10.98:1. */
                      active
                        ? "border-accent bg-accent text-ink-inverse"
                        : "border-line-control text-ink-2 hover:border-accent hover:text-ink",
                    )}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>

            {/* The things in that category. Tapping one IS choosing it — there is no confirm,
                because the next step is the confirm. */}
            <div className="flex min-w-0 flex-wrap gap-x-1 gap-y-2.5">
              {section.offers.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  data-field-offer={entry.id}
                  onClick={() => {
                    setOffer(entry);
                    setError(null);
                  }}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md border px-2.5 py-1",
                    /* ⚠ `--line-control` AT REST, not on hover. It was `border-line` with
                       `hover:border-line-control` — 1.23:1 until a pointer arrived, which is
                       both a 1.4.11 miss (3:1 for a control boundary) and information carried
                       by hover, which a phone never delivers. These seven buttons ARE the step,
                       so a reader who cannot see where they are cannot take it. 3.77:1 resting
                       on `--canvas`; `--ink` on it 20.03:1. Hover now moves the boundary to
                       `--accent` (16.67:1), which is emphasis rather than existence. */
                    "border-line-control bg-canvas text-xs text-ink",
                    "transition-colors hover:border-accent",
                    /* Same 44px pair as the category chips above, same reason. */
                    "max-md:min-w-11",
                    TOUCH_HIT_44_Y,
                    BUILDER_SCROLL_CLEAR,
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── step 2: one box, one button ──────────────────────────────────────────── */
          <form
            data-create-field-form=""
            aria-label={`New ${offer.label}`}
            aria-describedby={hintId}
            className="flex min-w-0 flex-1 flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (value.trim().length === 0) {
                /* Checked here rather than at the API: a blank value is rejected upstream too,
                   but a round trip to be told so reports a local mistake as a server failure. */
                setError("Give the field a value — a blank one would not show on the card.");
                return;
              }
              setError(null);
              void onCreate({
                type: offer.type,
                /* The offer's own label. "LinkedIn", not "Social link" — the vocabulary the
                   owner picked from is the vocabulary the card prints. Renameable in `/profile`. */
                label: offer.label,
                value: value.trim(),
                category: section.category,
              }).then((created) => {
                /* Cleared only on success. A failed create keeps the draft, because the
                   alternative is making somebody retype what they just lost.
                   On success it returns to step 1 rather than closing: adding two or three
                   things at once is the common case, and the category is still selected. */
                if (created !== null) clearOffer();
              });
            }}
          >
            <div className="flex min-w-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                iconOnly
                aria-label="Back to field types"
                data-field-offer-back=""
                onClick={clearOffer}
                className={cn("shrink-0", BUILDER_SCROLL_CLEAR)}
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
              </Button>
              <span data-field-offer-chosen="" className="truncate text-sm font-medium text-ink">
                {offer.label}
              </span>
            </div>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              {/* ⚠ The label is hidden and the placeholder carries the shape of the answer — the
                  client's "remove the kind and the value" survives here. `autoFocus` because the
                  owner just pressed the thing this box is for; without it the second step costs
                  a tap that the one-row composer did not. */}
              <Input
                autoFocus
                label={offer.label}
                hideLabel
                data-create-field-value=""
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  if (error !== null) setError(null);
                }}
                placeholder={offer.placeholder}
                inputMode={offer.inputMode}
                spellCheck={false}
                autoComplete="off"
                error={error ?? undefined}
                fieldClassName="min-w-0"
                className={BUILDER_SCROLL_CLEAR}
              />

              <Button
                type="submit"
                data-create-field-submit=""
                loading={creating}
                loadingLabel="Adding…"
                className={cn("shrink-0", BUILDER_SCROLL_CLEAR)}
              >
                Add
              </Button>
            </div>
          </form>
        )}

        {/* ⚠ ONE CONTROL, BOTH STATES — `[data-field-new-open]` with `aria-expanded` on it
            either way, so there is never a second button on the screen doing half of this
            one's job, and a screen reader is told which state it is in. It is written as two
            branches rather than one button with conditional props because `iconOnly` demands
            an `aria-label` in the type, and a spread cannot satisfy a discriminated union. */}
        {open ? (
          <Button
            type="button"
            variant="ghost"
            iconOnly
            aria-label="Cancel new field"
            data-field-new-open=""
            aria-expanded
            onClick={close}
            className={cn("shrink-0", BUILDER_SCROLL_CLEAR)}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            data-field-new-open=""
            aria-expanded={false}
            onClick={() => onOpenChange(true)}
            className={cn("shrink-0", BUILDER_SCROLL_CLEAR)}
          >
            <Plus aria-hidden="true" className="size-4" />
            New field
          </Button>
        )}
      </div>

      {/* One line, and only while the composer is open — a closed row has nothing to explain. */}
      {open ? (
        <p id={hintId} data-prose className="text-xs text-ink-3">
          Saved to your profile and ticked onto this card, in one step.
        </p>
      ) : null}
    </div>
  );
}
