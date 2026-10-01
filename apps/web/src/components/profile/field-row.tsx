"use client";

import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  FIELD_VALUE_CLASS,
  isMaskedField,
  renderFieldRow,
  type FieldRow as RenderedFieldRow,
} from "@/card/field-renderers";
import { ConfirmDialog } from "@/components/overlay";
import { Button } from "@/components/primitives/button";
import { Input } from "@/components/primitives/input";
import { RevealToggle, SensitiveToggle } from "@/components/profile/sensitive-toggle";
import { cn } from "@/lib/cn";
import { maskTail } from "@/lib/format";
import type { FieldCategory, ProfileField, ResolvedField } from "@/types/domain";

/**
 * One `ProfileField`, editable — spec §8D.3 (Profile · Field group), §4.5, §7.3, §11 E-41.
 *
 * ## Why this is not `<FieldList>`
 * T17's `FieldList` renders the same field *read-only*, on the card detail, the contact
 * detail and the public card. Three things it does are wrong for an editor and one thing
 * it cannot do at all:
 *
 * · It returns `null` for a blank value (E-07) and for `PHOTO`. On a read surface that is
 *   right — an empty row says nothing. In an editor a field whose value you just cleared
 *   would **disappear along with the control that could fix it**.
 * · It renders `tel:` / `mailto:` / `https:` anchors. Here a row is text plus controls:
 *   tapping a value in an editor means "I want to change this", and a row that dials a
 *   number instead is a trap. Nothing in this file emits an `href`, so this track opens no
 *   new tab and has no outbound-link surface at all (AC-32).
 * · It carries no reveal path, deliberately (AC-33). This screen is the one place a
 *   reveal is legitimate.
 *
 * ## The masking contract, restated where it is actually enforced
 * `isMaskedField()` (T12) is the single definition: the three financial types are masked
 * **whatever `isSensitive` says**, and any field of any type with `isSensitive: true` is
 * masked as well. `maskTail` shows the last 4 characters and returns a bare `••••` with no
 * tail at all for a value of 4 characters or fewer, so a short secret is never revealed by
 * its own mask.
 *
 * While a row is masked and not revealed, **nothing in its DOM subtree carries the raw
 * value** — not the display text, not a `title`, not an `href`, and not an input. The last
 * one is the reason `canEdit` exists: the edit form is populated from the stored value, so
 * opening it on a masked row would be an unlabelled reveal. The Edit button therefore
 * stays focusable and explains itself through `disabledReason` (T05) until the value is
 * revealed, rather than vanishing.
 */

/** §8.8: 16px pairs with `--text-base`, the size a value is set at here. */
const ICON_SIZE = 16;

/** §6.6's `LOCATION_TRACKING` presentation: a status pill, never a coordinate. */
const STATUS_CHIP =
  "inline-flex h-6 w-fit items-center rounded-full border border-line bg-surface-sunk px-3 text-xs text-ink";

/**
 * §11 E-41: the confirmation must state **how many cards use the field** before it is
 * deleted, in words the owner can act on. The count leads the sentence because the count
 * is the decision; the names follow because "3 cards" is not enough to know whether that
 * matters.
 */
export function cardsUsingConsequence(cardNames: readonly string[]): string {
  const count = cardNames.length;
  if (count === 0) return "0 cards use this field, so nothing else changes.";
  if (count === 1) return `1 card uses this field — ${cardNames[0]}. It will stop showing it.`;

  const shown = cardNames.slice(0, 3).join(", ");
  const remainder = count - Math.min(count, 3);
  const list = remainder > 0 ? `${shown} and ${remainder} more` : shown;
  return `${count} cards use this field — ${list}. They will stop showing it.`;
}

export interface ProfileFieldRowProps {
  field: ProfileField;
  /** The owning group's category. `renderFieldRow` needs it; a `ProfileField` has none. */
  category: FieldCategory;
  revealed: boolean;
  onToggleReveal: () => void;
  onEdit: (patch: { label: string; value: string }) => void;
  onToggleSensitive: (next: boolean) => void;
  /** Forwarded to `SensitiveToggle` — set when the flag is derived and cannot be stored. */
  sensitiveReadOnlyReason?: string;
  /** Reorder and delete exist only in the group editor (§8D.3). Omit on `/profile`. */
  onMove?: (direction: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onDelete?: () => void;
  /** Names of the cards that map this field — the E-41 blast radius, in words. */
  cardNames?: readonly string[];
}

export function ProfileFieldRow({
  field,
  category,
  revealed,
  onToggleReveal,
  onEdit,
  onToggleSensitive,
  sensitiveReadOnlyReason,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
  onDelete,
  cardNames = [],
}: ProfileFieldRowProps) {
  const [editing, setEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(field.label);
  const [valueDraft, setValueDraft] = useState(field.value);
  const [labelError, setLabelError] = useState<string | null>(null);
  const valueRef = useRef<HTMLInputElement>(null);

  const masked = isMaskedField(field);
  const hidden = masked && !revealed;
  const blank = field.value.trim().length === 0;

  // The resolved shape T12's registry reads. Built here because a `ProfileField` carries
  // no category and the ordering rule of §6.4 is expressed in terms of one.
  const resolved: ResolvedField = {
    id: field.id,
    type: field.type,
    category,
    label: field.label,
    value: field.value,
    isSensitive: field.isSensitive,
    ...(field.detail === undefined ? {} : { detail: field.detail }),
  };

  // `null` for `PHOTO` and for a blank value. Both still render a row here — see the
  // header note — so this is a source of *presentation*, never a gate on the row.
  const row: RenderedFieldRow | null = renderFieldRow(resolved, { iconSize: ICON_SIZE });

  // Opening the edit form on a masked row would put the raw value in an input. Reveal is
  // the one explicit gesture that un-masks, so it gates the form too.
  const canEdit = !hidden;

  useEffect(() => {
    if (editing) valueRef.current?.focus();
  }, [editing]);

  function startEditing() {
    setLabelDraft(field.label);
    setValueDraft(field.value);
    setLabelError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setLabelError(null);
    setEditing(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = labelDraft.trim();
    if (label.length === 0) {
      // A field with no label is a value nobody can identify later, including in the
      // delete confirmation. The value may legitimately be blanked (E-07); the label may not.
      setLabelError("Give the field a name.");
      return;
    }
    // The value is deliberately NOT trimmed away to nothing here — a blank value is a
    // legal state that E-07 excludes from cards without deleting the field.
    onEdit({ label, value: valueDraft });
    setEditing(false);
  }

  return (
    <li
      data-profile-field={field.id}
      data-field-type={field.type}
      {...(field.isSensitive ? { "data-field-sensitive": "" } : {})}
      {...(hidden ? { "data-field-masked": "" } : {})}
      {...(masked && revealed ? { "data-field-revealed": "" } : {})}
      className="flex flex-col gap-3 border-b border-line py-4 last:border-b-0 lg:flex-row lg:items-start lg:gap-6"
    >
      <span
        aria-hidden="true"
        className="mt-1 hidden size-4 shrink-0 items-center justify-center text-ink-3 lg:inline-flex"
      >
        {row?.icon}
      </span>

      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            data-field-edit-form={field.id}
            onSubmit={submit}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <Input
              label="Field name"
              value={labelDraft}
              error={labelError}
              onChange={(event) => setLabelDraft(event.target.value)}
              fieldClassName="min-w-0 flex-1"
            />
            <Input
              ref={valueRef}
              label="Value"
              value={valueDraft}
              onChange={(event) => setValueDraft(event.target.value)}
              fieldClassName="min-w-0 flex-1"
            />
            <div className="flex shrink-0 items-center gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="secondary" onClick={cancelEditing}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <>
            <p data-field-label="" className="text-xs text-ink-3">
              {field.label}
            </p>
            <FieldValue
              blank={blank}
              hidden={hidden}
              revealed={masked && revealed}
              rawValue={field.value}
              row={row}
            />
            {row?.context ? (
              <p data-field-context="" className="mt-1 text-xs text-ink-3">
                {row.context}
              </p>
            ) : null}
          </>
        )}
      </div>

      {editing ? null : (
        <div className=/* ⚠ The row gap is the one that matters on a phone. This cluster is up to six
             44px controls — Edit, Reveal, Move up, Move down, Delete and a Switch — whose
             max-content is ~382px against a 296px content box, so it wraps to two rows. At
             `gap-y-2` those rows sat 8px apart, which for two rows of 44px targets is a
             mis-tap waiting to happen. 12px between rows, 8px within one. */
          "flex flex-wrap items-center gap-x-2 gap-y-3 lg:gap-x-4 lg:gap-y-2 lg:shrink-0">
          <SensitiveToggle
            fieldId={field.id}
            fieldLabel={field.label}
            checked={field.isSensitive}
            onCheckedChange={onToggleSensitive}
            readOnlyReason={sensitiveReadOnlyReason}
          />

          {masked ? (
            <RevealToggle
              fieldId={field.id}
              fieldLabel={field.label}
              revealed={revealed}
              onToggle={onToggleReveal}
            />
          ) : null}

          <Button
            variant="ghost"
            iconOnly
            aria-label={`Edit ${field.label}`}
            data-field-edit={field.id}
            disabled={!canEdit}
            disabledReason={
              canEdit ? undefined : `Reveal ${field.label} before editing it.`
            }
            onClick={startEditing}
          >
            <Pencil size={ICON_SIZE} strokeWidth={1.5} />
          </Button>

          {onMove ? (
            <ReorderControls
              fieldLabel={field.label}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              onMove={onMove}
            />
          ) : null}

          {onDelete ? (
            <ConfirmDialog
              trigger={
                <Button
                  variant="ghost"
                  iconOnly
                  aria-label={`Delete ${field.label}`}
                  data-field-delete={field.id}
                >
                  <Trash2 size={ICON_SIZE} strokeWidth={1.5} />
                </Button>
              }
              overline="Delete field"
              title={`Delete ${field.label}?`}
              detail="This removes the field from your profile and from every card that shows it."
              consequence={cardsUsingConsequence(cardNames)}
              confirmLabel="Delete field"
              tone="destructive"
              onConfirm={onDelete}
            />
          ) : null}
        </div>
      )}
    </li>
  );
}

/**
 * The value cell — the one place the masking rule is actually visible.
 *
 * Order matters: the masked branch is checked **before** anything that could reach
 * `field.value`, so no later branch can leak past it.
 */
function FieldValue({
  blank,
  hidden,
  revealed,
  rawValue,
  row,
}: {
  blank: boolean;
  hidden: boolean;
  revealed: boolean;
  rawValue: string;
  row: RenderedFieldRow | null;
}) {
  if (blank) {
    return (
      <p data-field-value="" data-field-blank="" className="text-base text-ink-3">
        No value yet
      </p>
    );
  }

  if (hidden) {
    // `row.display` has already been masked by T12. The `maskTail` fallback covers the
    // one shape that produces no row at all — a `PHOTO` field the owner marked sensitive
    // — which would otherwise fall through to the raw-value branch below.
    return (
      <p data-field-value="" className={cn("text-base text-ink", FIELD_VALUE_CLASS)}>
        {row === null ? maskTail(rawValue) : row.display}
      </p>
    );
  }

  if (revealed) {
    // The stored value, verbatim: this is an editor, and the string the owner is about to
    // edit is the string they need to see. No `href` and no `title` — revealing is a
    // decision to *look*, not a decision to publish a link or to leave the value hoverable.
    return (
      <p
        data-field-value=""
        data-field-raw=""
        className={cn("text-base text-ink", FIELD_VALUE_CLASS)}
      >
        {rawValue}
      </p>
    );
  }

  if (row === null) {
    // `PHOTO`: no row on a card because the avatar slot owns it, but on the editor the
    // path is what the owner stored and what they may want to change.
    return (
      <p data-field-value="" className={cn("text-base text-ink", FIELD_VALUE_CLASS)}>
        {rawValue}
      </p>
    );
  }

  if (row.variant === "status") {
    return (
      <span data-field-value="" data-field-status="" className={STATUS_CHIP}>
        {row.display}
      </span>
    );
  }

  return (
    <p data-field-value="" className={cn("text-base text-ink", FIELD_VALUE_CLASS)}>
      {row.lines.map((line, index) => (
        <span key={`${line}-${index}`} className="block">
          {line}
        </span>
      ))}
    </p>
  );
}

/**
 * Reorder, as two buttons rather than drag-and-drop.
 *
 * Drag-and-drop with no keyboard equivalent fails AC-26 outright, and the keyboard
 * equivalent of a drag *is* a pair of move buttons — so the buttons are the feature and
 * the drag would be the decoration. At the ends of the list the control keeps its place
 * in the tab order and explains why it does nothing (§8D.7).
 */
function ReorderControls({
  fieldLabel,
  canMoveUp,
  canMoveDown,
  onMove,
}: {
  fieldLabel: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    /* ⚠ `gap-2` on touch. Move-up and move-down are a 44px pair that do OPPOSITE things, and at
       `gap-1` they sat 4px apart — the closest pair of adjacent, mutually-undoing targets in the
       product. 8px is still a tight pair visually and doubles the margin for a miss. */
    <span className="inline-flex items-center gap-2 lg:gap-1">
      <Button
        variant="ghost"
        iconOnly
        aria-label={`Move ${fieldLabel} up`}
        data-field-move="up"
        disabled={!canMoveUp}
        disabledReason={canMoveUp ? undefined : `${fieldLabel} is already first.`}
        onClick={() => onMove(-1)}
      >
        <ArrowUp size={ICON_SIZE} strokeWidth={1.5} />
      </Button>
      <Button
        variant="ghost"
        iconOnly
        aria-label={`Move ${fieldLabel} down`}
        data-field-move="down"
        disabled={!canMoveDown}
        disabledReason={canMoveDown ? undefined : `${fieldLabel} is already last.`}
        onClick={() => onMove(1)}
      >
        <ArrowDown size={ICON_SIZE} strokeWidth={1.5} />
      </Button>
    </span>
  );
}
