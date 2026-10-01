"use client";

import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Dialog } from "@/components/overlay";
import { Button } from "@/components/primitives/button";
import { Chip } from "@/components/primitives/chip";
import { Input } from "@/components/primitives/input";
import {
  COMMON_TYPES,
  FIELD_TYPE_INPUT_MODES,
  FIELD_TYPE_LABELS,
  FIELD_TYPE_PLACEHOLDERS,
  MORE_TYPES,
  PHOTO_REDIRECT_HINT,
  isAlwaysMasked,
  needsOwnName,
} from "@/components/profile/field-types";
import type { FieldGroup, FieldType } from "@/types/domain";

/**
 * "Add field" — spec §8D.3 (Profile), §5.5, §4.5.
 *
 * ## What this replaced, and why every change is a defect and not a preference
 *
 * The previous control was a **popover anchored to its own trigger** containing four inputs:
 * a type `Select`, "Field name", "Value", and a "Sensitive" switch. It was reported as
 * confusing, and reading it explains why — most of what it showed was wrong:
 *
 * 1. **The value placeholder was hardcoded to `FIELD_TYPE_PLACEHOLDERS.EMAIL`.** The file
 *    defined a complete per-type placeholder map, documented it at length, and then ignored
 *    it: choosing **Note** left the box reading `you@example.com`. The name box was frozen at
 *    `Work email` for the same reason. So the form actively described a different field from
 *    the one being added.
 * 2. **`FIELD_TYPE_INPUT_MODES` was declared and never applied**, so a phone number was typed
 *    on the alphabetic keyboard despite the map existing to prevent exactly that.
 * 3. **The "Sensitive" switch was collected and discarded.** `isSensitive` is absent from
 *    `CreateProfileFieldDto` on both sides of the wire — the server derives masking from the
 *    field's type — and `profile-client.tsx`'s `addField` never sent it. Worse, every row on
 *    the same screen already says *"Set by the field's type"* and disables its own toggle, so
 *    the form contradicted the list it was adding to.
 * 4. **`PHOTO` was offered in the picker.** `POST /profile/fields` rejects it outright.
 *    Choosing it was a guaranteed server error.
 * 5. **"Field name" and "Value" were asked as two peer questions** with no stated difference,
 *    which is the confusion as reported. For nineteen of the twenty types the answer to the
 *    first is simply the type's own name.
 *
 * ## The shape now
 *
 * A **modal dialog**, not a popover over the trigger — the old panel covered the group it was
 * adding to and the heading above it. Two decisions instead of four:
 *
 * · **Pick a kind**, from eight visible choices with the rest one disclosure away. A `Select`
 *   put all twenty behind a click and ordered them by nothing the reader could see.
 * · **Type the value**, into one box labelled with the kind just chosen, carrying that kind's
 *   own placeholder and keyboard.
 *
 * The row's name is derived from the type and stated in words — *"Saved as Email"* — with a
 * **Rename** control for the occasions it matters. `CUSTOM` and `TEXT` skip the derivation and
 * ask outright, because a row called "Custom" tells a reader nothing (see `needsOwnName`).
 *
 * ## Focus, and what this file deliberately does not do
 * Nothing here touches focus. Radix moves it into the panel on open and back to the trigger on
 * close; a hand-rolled `autoFocus` or a `preventDefault` on `onOpenAutoFocus` is exactly how
 * E-50 gets broken by a change that only meant to be helpful. The panel closes by setting
 * `open` to `false`, never by moving focus somewhere else first.
 *
 * ## A card is a filter, so this is where cards get their content
 * §5.3: a card owns no data. A field added here becomes tickable in **every** card builder
 * immediately, and a card that maps nothing renders name-only — the old build's 73-byte `.vcf`
 * (§11 E-01/E-02). The dialog no longer says so in a description line (client, 2026-09-28:
 * strip the explanatory copy); the title and the kind chips are enough to act on.
 */

export interface NewFieldDraft {
  type: FieldType;
  label: string;
  value: string;
  /**
   * ⚠ Always `false`, and kept only because `profile-client.tsx` and the group editor both
   * destructure it. Masking is the server's decision, taken from the field's type — there has
   * never been a wire field for an owner's own answer, so a control offering one was theatre.
   * See the module note. Remove the property when those two call sites stop reading it.
   */
  isSensitive: boolean;
}

export interface AddFieldDialogProps {
  group: FieldGroup;
  onAdd: (draft: NewFieldDraft) => void;
  /** `secondary` inside a populated group, `primary` inside an empty one. */
  variant?: "primary" | "secondary";
}

const DEFAULT_TYPE: FieldType = "TEXT";

export function AddFieldDialog({ group, onAdd, variant = "secondary" }: AddFieldDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FieldType>(DEFAULT_TYPE);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [showMore, setShowMore] = useState(false);
  /** Only for the types that name themselves — the owner asked to override the derived name. */
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valueError, setValueError] = useState<string | null>(null);

  /* `CUSTOM`/`TEXT` are asked outright; everything else is named by its kind unless the owner
     has opened Rename and typed something. */
  const asksForName = needsOwnName(type) || renaming;
  const derivedName = FIELD_TYPE_LABELS[type];
  const effectiveName = asksForName ? label.trim() : derivedName;

  function reset() {
    setType(DEFAULT_TYPE);
    setLabel("");
    setValue("");
    setShowMore(false);
    setRenaming(false);
    setError(null);
    setValueError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Dismissing without adding discards the draft, so re-opening is not a half-typed field
    // the owner has to clear. Radix calls this for Escape and outside clicks too.
    if (!next) reset();
  }

  function pickType(next: FieldType) {
    setType(next);
    /* ⚠ The name is cleared with the kind, never carried across. A label typed for **Email**
       sitting above a **Bank account** box is the same class of lie the hardcoded placeholder
       was: the form describing a different field from the one being added. */
    setLabel("");
    setRenaming(false);
    setError(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedValue = value.trim();
    const name = effectiveName;

    /* Both are `@MinLength(1)` on `CreateProfileFieldDto`, so both are checked here rather
       than discovered as a 400 after the dialog has closed. */
    if (name.length === 0) {
      setError("Give the field a name — it is what the row is called.");
      return;
    }
    if (trimmedValue.length === 0) {
      setValueError("Add a value — an empty field has nothing to show on a card.");
      return;
    }

    onAdd({ type, label: name, value: trimmedValue, isSensitive: false });
    setOpen(false);
    reset();
  }

  const placeholder = FIELD_TYPE_PLACEHOLDERS[type];

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      size="md"
      overline={group.name}
      title="Add a field"
      trigger={
        <Button variant={variant} data-add-field={group.id}>
          <Plus aria-hidden="true" size={16} strokeWidth={1.5} />
          Add field
        </Button>
      }
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {/* Submits the form by id: the footer is a sibling of the form, not a child. */}
          <Button type="submit" form={`add-field-${group.id}`}>
            Add field
          </Button>
        </div>
      }
    >
      <form
        id={`add-field-${group.id}`}
        data-add-field-form={group.id}
        onSubmit={submit}
        className="flex flex-col gap-5"
      >
        {/* ── the kind, visible rather than behind a dropdown ─────────────────────────── */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-ink">What kind of field?</legend>
          <div data-field-type-picker="" className="flex flex-wrap gap-2 pt-1">
            {COMMON_TYPES.map((option) => (
              <Chip
                key={option}
                interactive
                selected={type === option}
                data-field-type={option}
                onClick={() => pickType(option)}
              >
                {FIELD_TYPE_LABELS[option]}
              </Chip>
            ))}

            {/* The twelve rarer kinds, one disclosure away rather than absent. */}
            {showMore
              ? MORE_TYPES.map((option) => (
                  <Chip
                    key={option}
                    interactive
                    selected={type === option}
                    data-field-type={option}
                    onClick={() => pickType(option)}
                  >
                    {FIELD_TYPE_LABELS[option]}
                  </Chip>
                ))
              : null}

            {showMore ? null : (
              <Button
                type="button"
                variant="text-link"
                data-field-type-more=""
                onClick={() => setShowMore(true)}
              >
                {`More types (${MORE_TYPES.length})`}
              </Button>
            )}
          </div>
        </fieldset>

        {/* ── the value, labelled by the kind and carrying its own example ─────────────── */}
        <div className="flex flex-col gap-2">
          <Input
            // For a self-naming kind the box IS the field: "Email", not "Value".
            label={needsOwnName(type) ? "Value" : FIELD_TYPE_LABELS[type]}
            value={value}
            error={valueError}
            /* `|| undefined` and not `??`: the four structured kinds carry `""` for "no hint",
               and an empty-string placeholder renders an empty attribute rather than none. */
            placeholder={placeholder || undefined}
            inputMode={FIELD_TYPE_INPUT_MODES[type]}
            hint={isAlwaysMasked(type) ? "Always masked, wherever it appears." : undefined}
            onChange={(event) => {
              setValue(event.target.value);
              if (valueError !== null) setValueError(null);
            }}
          />

          {/* ── the row's name: derived and stated, or asked for ──────────────────────── */}
          {asksForName ? (
            <Input
              label="Field name"
              value={label}
              error={error}
              placeholder={needsOwnName(type) ? "Studio motto" : derivedName}
              hint="What this row is called on your profile and on a card."
              onChange={(event) => {
                setLabel(event.target.value);
                if (error !== null) setError(null);
              }}
            />
          ) : (
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink-3">
              <span data-derived-name={derivedName}>Saved as “{derivedName}”.</span>
              <Button
                type="button"
                variant="text-link"
                data-field-rename=""
                onClick={() => {
                  // Seeded with the derived name so Rename is an edit, not a blank box.
                  setLabel(derivedName);
                  setRenaming(true);
                }}
              >
                Rename
              </Button>
            </p>
          )}
        </div>

        {/* ⚠ Only once the full list is open, which is the moment somebody is hunting for a
            kind they cannot see. Shown unconditionally it is a permanent line of noise on a
            dialog whose whole point is that it stopped asking unnecessary questions. */}
        {showMore ? <p className="text-sm text-ink-3">{PHOTO_REDIRECT_HINT}</p> : null}
      </form>
    </Dialog>
  );
}
