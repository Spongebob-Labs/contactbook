"use client";

import { Pencil, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { FIELD_VALUE_CLASS, isMaskedField, renderFieldRow } from "@/card/field-renderers";
import { BUILDER_SCROLL_CLEAR } from "@/components/builder/scroll-clear";
import { Button, Checkbox } from "@/components/primitives";
import { RevealToggle } from "@/components/profile/sensitive-toggle";
import { cn } from "@/lib/cn";
import { maskTail } from "@/lib/format";
import type { FieldCategory, FieldType, ProfileField, ResolvedField } from "@/types/domain";

/**
 * One row of the `/profile` workspace — a stored field, or a blank one waiting to be filled.
 *
 * ## The whole row is the edit target
 *
 * Client, 2026-09-28: *"clicking directly on a field should open it for editing; edit button is
 * too far right and hard to find."* So the label and the value are one `<button>`, and pressing
 * it swaps them for inputs in place. The pencil sits right after the value as a hint, not at
 * the row's far edge. The far edge belongs to the one other control a row has: the tick for
 * whether the selected card shows this field.
 *
 * ## Editing never loses what was typed
 *
 * Enter saves, Escape cancels, and moving focus out of the row saves too, so tapping somewhere
 * else keeps the edit. Save and Cancel are also visible buttons for a phone keyboard with no
 * obvious Enter. They swallow `mousedown`, so pressing one never blurs the input first.
 *
 * ## Masked rows keep the reveal-first rule
 *
 * A financial value is masked until revealed, and nothing in the row's DOM carries the raw value
 * while it is. Pressing a masked row reveals it; pressing it again edits it. The edit form is
 * filled from the stored value, so opening it blind would be an unlabelled reveal.
 */

export interface RowCardToggle {
  cardName: string;
  on: boolean;
  onChange: (next: boolean) => void;
}

export interface WorkspaceFieldRowProps {
  /** The stored field, or `null` for a blank suggestion or a field being added. */
  field: ProfileField | null;
  /** The category the value is rendered as. A `ProfileField` carries none of its own. */
  category: FieldCategory;
  label: string;
  type: FieldType;
  /** A blank row's muted line — "Add date of birth". */
  prompt?: string;
  placeholder?: string;
  inputMode?: "tel" | "email" | "url" | "numeric";
  /** Open in edit mode on mount: a field just picked from "Add field". */
  autoEdit?: boolean;
  /** Whether the label is an input while editing. */
  labelEditable?: boolean;
  revealed?: boolean;
  onToggleReveal?: () => void;
  onSave: (patch: { label: string; value: string }) => void;
  /** Called when editing ends without a save. */
  onCancel?: () => void;
  /** The selected card's switch. Absent for blank rows and fields still being created. */
  toggle?: RowCardToggle | null;
  /** `[data-suggestion]`, for a blank suggested row. */
  suggestionId?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function WorkspaceFieldRow({
  field,
  category,
  label,
  type,
  prompt,
  placeholder,
  inputMode,
  autoEdit = false,
  labelEditable = false,
  revealed = false,
  onToggleReveal,
  onSave,
  onCancel,
  toggle,
  suggestionId,
}: WorkspaceFieldRowProps) {
  const [editing, setEditing] = useState(autoEdit);
  const [labelDraft, setLabelDraft] = useState(label);
  const [valueDraft, setValueDraft] = useState(field?.value ?? "");
  const [error, setError] = useState<string | null>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);
  /** Put focus back on the row after Enter or Escape, but not after a blur the owner caused. */
  const restoreFocus = useRef(false);
  const valueId = useId();
  const errorId = `${valueId}-error`;

  const masked = field !== null && isMaskedField(field);
  const hidden = masked && !revealed;
  const blank = field === null || field.value.trim() === "";

  useEffect(() => {
    if (editing) valueRef.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      openRef.current?.focus();
    }
  }, [editing]);

  function open() {
    if (hidden) {
      onToggleReveal?.();
      return;
    }
    setLabelDraft(label);
    setValueDraft(field?.value ?? "");
    setError(null);
    setEditing(true);
  }

  function stop(refocus: boolean) {
    restoreFocus.current = refocus;
    setError(null);
    setEditing(false);
  }

  function cancel(refocus: boolean) {
    stop(refocus);
    onCancel?.();
  }

  function commit(reason: "submit" | "blur") {
    const value = valueDraft.trim();
    const nextLabel = labelDraft.trim();
    const unchanged =
      field !== null && value === field.value.trim() && nextLabel === field.label.trim();

    if (unchanged) {
      stop(reason === "submit");
      return;
    }
    if (value === "") {
      /* Nothing typed into a blank row is nothing to lose, so leaving it just closes it. A
         stored field cannot be emptied (the API needs a value), so it stays open and says so. */
      if (field === null && reason === "blur") {
        cancel(false);
        return;
      }
      setError("Enter a value.");
      return;
    }
    if (nextLabel === "") {
      setError("Give the field a name.");
      return;
    }
    onSave({ label: nextLabel, value });
    stop(reason === "submit");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commit("submit");
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel(true);
    }
  }

  const dateInput = type === "DATE" && (valueDraft === "" || ISO_DATE.test(valueDraft));

  return (
    <li
      data-workspace-row={field?.id ?? suggestionId ?? "new"}
      data-field-type={type}
      {...(blank ? { "data-workspace-row-blank": "" } : {})}
      {...(suggestionId === undefined ? {} : { "data-suggestion": suggestionId })}
      {...(field?.isSensitive ? { "data-field-sensitive": "" } : {})}
      {...(hidden ? { "data-field-masked": "" } : {})}
      {...(masked && revealed ? { "data-field-revealed": "" } : {})}
      {...(editing ? { "data-workspace-row-editing": "" } : {})}
      className="flex min-h-14 items-center gap-2 border-t border-line px-3 first:border-t-0 sm:px-4"
    >
      {editing ? (
        <form
          data-workspace-row-form=""
          onSubmit={onSubmit}
          onKeyDown={onKeyDown}
          onBlur={(event) => {
            const next = event.relatedTarget;
            if (next instanceof Node && event.currentTarget.contains(next)) return;
            commit("blur");
          }}
          className="flex min-w-0 flex-1 flex-col gap-2 py-3"
        >
          {labelEditable ? (
            <input
              aria-label="Field name"
              data-workspace-row-label-input=""
              value={labelDraft}
              maxLength={80}
              onChange={(event) => setLabelDraft(event.target.value)}
              className={cn(
                "w-full max-w-72 rounded-sm border-b border-line-control bg-transparent px-0.5 py-0.5",
                "text-xs text-ink-2 focus:border-accent focus:outline-none",
                BUILDER_SCROLL_CLEAR,
              )}
            />
          ) : (
            <label htmlFor={valueId} className="text-xs text-ink-3">
              {label}
            </label>
          )}

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={valueRef}
              id={valueId}
              data-workspace-row-input=""
              type={dateInput ? "date" : "text"}
              value={valueDraft}
              placeholder={placeholder}
              inputMode={dateInput ? undefined : inputMode}
              maxLength={4000}
              spellCheck={false}
              autoComplete="off"
              {...(labelEditable ? { "aria-label": labelDraft.trim() || label } : {})}
              aria-invalid={error === null ? undefined : true}
              aria-describedby={error === null ? undefined : errorId}
              onChange={(event) => {
                setValueDraft(event.target.value);
                if (error !== null) setError(null);
              }}
              className={cn(
                "h-10 min-w-0 flex-1 rounded-md border border-line-control bg-canvas px-3",
                "text-sm text-ink placeholder:text-ink-4",
                "focus:border-accent focus:outline-none",
                error !== null && "border-danger",
                BUILDER_SCROLL_CLEAR,
              )}
            />
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="submit"
                data-workspace-row-save=""
                className={BUILDER_SCROLL_CLEAR}
                onMouseDown={(event) => event.preventDefault()}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                data-workspace-row-cancel=""
                className={BUILDER_SCROLL_CLEAR}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => cancel(true)}
              >
                Cancel
              </Button>
            </div>
          </div>

          {error === null ? null : (
            <p id={errorId} role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
        </form>
      ) : (
        <button
          ref={openRef}
          type="button"
          data-workspace-row-open=""
          onClick={open}
          aria-label={
            hidden
              ? `Reveal ${label}`
              : blank
                ? prompt ?? `Add ${label}`
                : undefined
          }
          className={cn(
            "group -mx-2 flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-md px-2 py-2.5 text-left",
            "transition-colors duration-[var(--dur-fast)] hover:bg-surface/70",
            /* Below `lg` the preview is pinned over the top of the page, so anything scrolled
               into view must stop under it rather than behind it. */
            BUILDER_SCROLL_CLEAR,
          )}
        >
          <span data-field-label="" className="max-w-full truncate text-xs text-ink-3">
            {label}
          </span>
          <span className="flex min-w-0 max-w-full items-center gap-1.5">
            {blank ? (
              <span data-field-value="" data-field-blank="" className="flex items-center gap-1.5 text-sm text-ink-3">
                <Plus aria-hidden="true" className="size-3.5 shrink-0" />
                {prompt ?? `Add ${label.toLowerCase()}`}
              </span>
            ) : (
              <>
                <RowValue field={field} category={category} hidden={hidden} revealed={masked && revealed} />
                <Pencil
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 shrink-0 text-ink-4 transition-opacity duration-[var(--dur-fast)]",
                    "md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100",
                  )}
                />
              </>
            )}
          </span>
        </button>
      )}

      {/* Hidden, the row itself is the reveal; once shown, this is the way to hide it again.
          One control per action, so a screen reader never hears "Reveal Account" twice. */}
      {editing || !masked || !revealed || onToggleReveal === undefined || field === null ? null : (
        <RevealToggle
          fieldId={field.id}
          fieldLabel={label}
          revealed={revealed}
          onToggle={onToggleReveal}
        />
      )}

      {editing || toggle === undefined || toggle === null ? null : (
        /* A tick, the same control the builder's field list uses for the same question — an
           empty outlined box against a filled one with a check, readable without colour. */
        <Checkbox
          data-workspace-row-toggle={field?.id ?? ""}
          checked={toggle.on}
          onCheckedChange={(next) => toggle.onChange(next === true)}
          label={`Show ${label} on ${toggle.cardName}`}
          hideLabel
          className={BUILDER_SCROLL_CLEAR}
          rowClassName="shrink-0 px-3"
        />
      )}
    </li>
  );
}

/**
 * The value, as the card would print it.
 *
 * The masked branch runs before anything that could reach the raw value, so no later branch can
 * leak past it. Spans only: this sits inside a `<button>`.
 */
function RowValue({
  field,
  category,
  hidden,
  revealed,
}: {
  field: ProfileField;
  category: FieldCategory;
  hidden: boolean;
  revealed: boolean;
}) {
  const resolved: ResolvedField = {
    id: field.id,
    type: field.type,
    category,
    label: field.label,
    value: field.value,
    isSensitive: field.isSensitive,
    ...(field.detail === undefined ? {} : { detail: field.detail }),
  };
  const row = renderFieldRow(resolved, { iconSize: 16 });
  const base = cn("min-w-0 text-sm text-ink", FIELD_VALUE_CLASS);

  if (hidden) {
    return (
      <span data-field-value="" className={base}>
        {row === null ? maskTail(field.value) : row.display}
      </span>
    );
  }
  if (revealed || row === null) {
    return (
      <span data-field-value="" {...(revealed ? { "data-field-raw": "" } : {})} className={base}>
        {field.value}
      </span>
    );
  }
  return (
    <span data-field-value="" className={cn(base, "line-clamp-2")}>
      {row.lines.join(", ")}
    </span>
  );
}
