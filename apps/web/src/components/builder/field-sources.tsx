"use client";

import { EyeOff, Plus, X } from "lucide-react";
import { useId, useState, type ReactElement } from "react";

import { Button, Input, Select } from "@/components/primitives";
import {
  FIELD_TYPE_INPUT_MODES,
  FIELD_TYPE_PLACEHOLDERS,
} from "@/components/profile/field-types";
import { cn } from "@/lib/cn";
import type { FieldType } from "@/types/domain";

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

/**
 * The label a masked row wears.
 *
 * ⚠ `shrink-0` and `whitespace-nowrap` are load-bearing on a phone. This pill is a flex item in
 * a row whose text column is about 105px at 320px, while "Masked when shared" needs ~142px. A
 * flex item's `min-width` is `auto`, so instead of overflowing it shrank and wrapped its own
 * label across two lines *inside a `rounded-full`* — a broken pill silhouette that reads as a
 * rendering fault rather than a label. The row already wraps, so the pill takes its own line
 * when there is no room beside the label.
 */
export function MaskedMarker({ sensitive }: { sensitive: boolean }): ReactElement {
  return (
    <span
      data-field-sensitive=""
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-surface-sunk px-2 py-0.5 text-xs text-ink-3"
    >
      <EyeOff aria-hidden="true" className="size-3" />
      {sensitive ? "Sensitive" : "Masked when shared"}
    </span>
  );
}

/**
 * The kinds a field can be made as, without leaving the builder.
 *
 * A shortlist, not the full `FieldType` union: the 21 types include structured payment and
 * wallet kinds whose editors live in `/profile`, and offering them here would promise an editor
 * this form does not have. "Anything else" is `TEXT`, which is the honest escape hatch.
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

/**
 * **Author a field the profile does not have yet — one row, closed until it is asked for.**
 *
 * ## ⚠ FOURTH SHAPE. THE THIRD WAS A PERMANENT TWO-INPUT COLUMN, AND IT WAS NOISE.
 *
 * · **A modal** (`add-field-dialog.tsx`, deleted) — the result of an add sat behind an overlay
 *   on top of the very preview it changed. Client: *"why it opens a pop-up?"*
 * · **Two columns below the card's own field list** (deleted) — the add controls began ~970px
 *   down a panel that scrolled inside a panel.
 * · **A permanent headed column beside the list**, with a labelled **Kind** select over a
 *   labelled **Value** box. It fixed the reachability and bought noise instead: two form labels,
 *   two controls, a submit and a sentence of explanation, all standing open on a screen whose
 *   subject is *picking* fields, every time the panel opened — and it took a third of the panel's
 *   width away from the list that is the actual work. Client, 2026-09-07: *"still quite noisy. I
 *   would remove the kind and the value."*
 *
 * ## What it is now
 *
 *     ┌ + New field ─────────────────────────────────────┐   ← closed: one row, ~40px
 *     ├──────────────────────────────────────────────────┤
 *     │ PERSONAL                                          │
 *     │ ☑ Mobile              +91 99532 66232             │
 *
 *     ┌ [ Phone ▾ ] [ +91 98765 43210      ] [ Add ] [✕] ┐   ← open, in place
 *     │ Saved to your profile and ticked onto this card.  │
 *
 * Three properties, and each one answers a rejection above:
 *
 *   · **Closed is the resting state, and closed costs one row.** The panel opens on a list of
 *     fields and nothing else, which is what the section is for.
 *   · **⚠ The labels are gone from the screen, not from the accessibility tree.** `hideLabel`
 *     keeps "Kind" and "Value" on the controls for a screen reader (AC-25 sweeps every route
 *     with axe, and an unlabelled input is a serious violation) while the visible affordances
 *     are a select that already reads "Phone" and a box whose placeholder is a phone number.
 *   · **⚠ It is the FIRST row of the list, so its position cannot depend on the field count.**
 *     That is the defect the client reported twice — *"the user will be scrolling up and up…
 *     he has to scroll down and go on to the new field"* — and the only structural guard
 *     against it is being anchored to the top rather than to the end.
 *
 * ## ⚠ Where the new row appears is NOT here, and that is deliberate
 *
 * A created field lands in the list in the profile's own order — inside its category group,
 * wherever that falls — because nothing in this panel may re-sort on a change (see
 * `field-picker.tsx`). What confirms the add is therefore not movement in this list: it is the
 * field appearing **on the card in the pinned preview**, in the same frame, plus the toast
 * `builder-client.tsx` raises. A row that jumped to the top to be seen would break the one rule
 * three layouts died for.
 */
export function NewFieldRow({
  open,
  onOpenChange,
  onCreate,
  creating,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreate: (draft: {
    type: FieldType;
    label: string;
    value: string;
  }) => Promise<CreatedField | null>;
  creating: boolean;
}): ReactElement {
  const [type, setType] = useState<FieldType>("PHONE");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();

  return (
    <div
      data-field-new=""
      data-field-new-open-state={open ? "open" : "closed"}
      className={cn(
        /* The same band the group labels sit on, so the row reads as part of the list rather
           than as a widget parked on top of it. */
        "flex flex-col gap-2 border-b border-line bg-surface px-3 py-2",
        "@container/new",
      )}
    >
      {/* ⚠ `items-start`, not `items-center`. The composer is two rows tall on a phone (see the
          grid below), and a centred close button then floats against the seam between them —
          measured at 360px and it reads as a stray glyph. Top-aligned, it is where a close
          control belongs. */}
      <div className="flex min-w-0 items-start gap-2">
        {open ? (
          <form
            data-create-field-form=""
            /* Named and described, so the sentence under the row is announced on entering the
               composer rather than left as decoration. `<Input>`'s own `aria-describedby` is
               owned by `<Field>` (it wires the error), which is why the description hangs on
               the form instead of on the box. */
            aria-label="New field"
            aria-describedby={hintId}
            /**
             * ⚠ **A GRID WITH TWO SHAPES, BECAUSE `flex-wrap` PUT THEM IN THE WRONG ORDER.**
             *
             * Wide, there is room for one line: `[ kind ] [ value ] [ Add ]`. Narrow (measured
             * at 360px, where this panel is ~324px and the form gets ~250 of it) the three
             * controls need 136 + 144 + 72 and cannot share a line — and `flex-wrap` broke it as
             * *kind* / *value* / *Add*, three rows, because a wrapped flex item takes the whole
             * of the next line. The grid puts the kind on its own row and pairs the value with
             * its Add, which is the pairing that matters: the button acts on the box beside it.
             *
             * `@container/new`, not a viewport breakpoint — same reason as everywhere else on
             * this panel: at 1024 the panel is *narrower* than at 768, because that is where the
             * split view hands 400px to the preview.
             */
            className={cn(
              "grid min-w-0 flex-1 items-start gap-2",
              "grid-cols-[minmax(0,1fr)_auto]",
              "@min-[26rem]/new:grid-cols-[8.5rem_minmax(0,1fr)_auto]",
            )}
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
                type,
                /* Defaulted from the kind rather than demanded. The kind already says what the
                   row is, and it is renameable in `/profile`. */
                label: QUICK_TYPES.find((quick) => quick.value === type)?.label ?? "Field",
                value: value.trim(),
              }).then((created) => {
                /* Cleared only on success. A failed create keeps the draft, because the
                   alternative is making somebody retype what they just lost. */
                if (created !== null) setValue("");
              });
            }}
          >
            {/* ⚠ `hideLabel` on both, and that is the client's "remove the kind and value" —
                the two printed labels go, the accessible names stay. */}
            <Select
              label="Kind"
              hideLabel
              value={type}
              onValueChange={(next) => setType(next as FieldType)}
              items={QUICK_TYPES.map((quick) => ({ value: quick.value, label: quick.label }))}
              fieldClassName="col-span-2 min-w-0 @min-[26rem]/new:col-span-1"
              className={BUILDER_SCROLL_CLEAR}
            />

            {/*
              ⚠ THE PLACEHOLDER AND THE KEYBOARD BOTH FOLLOW THE KIND — and with the label
              hidden they are now the *only* thing that says what goes in the box, which makes
              them load-bearing rather than a nicety. Both maps are `Record<FieldType, …>` in
              `profile/field-types.ts`, beside the type labels, so this screen and the profile's
              own add-field flow cannot disagree about what a phone number looks like.

              `key={type}` is deliberate: without it React keeps the same input element across a
              kind change, and Chrome does not always repaint a `placeholder` that changed while
              the element kept focus. Remounting on the kind makes the hint change every time.
            */}
            <Input
              key={type}
              label="Value"
              hideLabel
              data-create-field-value=""
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error !== null) setError(null);
              }}
              placeholder={FIELD_TYPE_PLACEHOLDERS[type] || undefined}
              inputMode={FIELD_TYPE_INPUT_MODES[type]}
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
          </form>
        ) : null}

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
            onClick={() => {
              onOpenChange(false);
              setError(null);
            }}
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

      {/* One line, and only while the form is open — a closed row has nothing to explain. */}
      {open ? (
        <p id={hintId} data-prose className="text-xs text-ink-3">
          Saved to your profile and ticked onto this card, in one step.
        </p>
      ) : null}
    </div>
  );
}
