"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { Camera, PenLine, Plus } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * The controls `/welcome` draws ON the card, through `<CardPage edit={…}>`.
 *
 * Every one is a real `<button>` or a real text field with an accessible name, and every empty
 * region says what tapping it does ("Add a photo", "Add a short bio"). They are styled from the
 * card's own custom properties (`--cb-sheet`, `--cb-sheet-ink`, `--c-ink`), which `CardPage` sets
 * on its root — so a control reads correctly on all eleven palettes without knowing which one it
 * is on, the same way the card's own lines do.
 *
 * ⚠ Focus rings: the global `:focus-visible` rule is unlayered, so no utility class can move it.
 * The cover control sets `outline-offset` INLINE — the one thing that outranks it — to pull the
 * ring inside the cover, whose `overflow: hidden` would otherwise clip it.
 */

/* ── the cover ─────────────────────────────────────────────────────────────── */

export interface CoverEditButtonProps {
  hasPhoto: boolean;
  /** Decoding the chosen file, or uploading the crop. The control says so and ignores taps. */
  busy: boolean;
  onPick: () => void;
}

/** A pill in sheet paper: legible over any photograph and on every palette's gradient. */
const PILL: CSSProperties = {
  background: "var(--cb-sheet)",
  color: "var(--cb-sheet-ink)",
  boxShadow: "var(--elevation-1)",
};

export function CoverEditButton({ hasPhoto, busy, onPick }: CoverEditButtonProps): ReactElement {
  const label = busy ? "Uploading…" : hasPhoto ? "Change photo" : "Add a photo";

  return (
    <button
      type="button"
      data-welcome-cover=""
      data-state={hasPhoto ? "photo" : "empty"}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      onClick={() => {
        if (!busy) onPick();
      }}
      className={cn(
        "group relative flex w-full cursor-pointer p-3",
        hasPhoto ? "items-start justify-end" : "items-center justify-center",
      )}
      style={{ outlineOffset: "-4px" }}
    >
      {/* The drop-zone edge, on an empty cover only: it says "this rectangle is the photo" in
          the palette's own proven ink. A photograph needs no frame drawn round it. */}
      {hasPhoto ? null : (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-3 rounded-2xl border-[1.5px] border-dashed opacity-60 transition-opacity duration-[var(--dur-fast)] group-hover:opacity-90"
          style={{ borderColor: "var(--c-ink)" }}
        />
      )}
      <span
        className="relative inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium"
        style={PILL}
      >
        <Camera aria-hidden="true" className="size-4" />
        {label}
      </span>
    </button>
  );
}

/* ── the two text lines ────────────────────────────────────────────────────── */

export interface InlineTextProps {
  /** `data-welcome-edit` value, and the key a test addresses the region by. */
  region: "headline" | "bio";
  /** The field's name, spoken before its value: "Role", "Bio". */
  label: string;
  /** What the empty region says: "Add your role". */
  hint: string;
  placeholder: string;
  /** What the line shows now. `""` renders the hint. */
  value: string;
  maxLength: number;
  multiline?: boolean;
  editing: boolean;
  busy?: boolean;
  onEdit: () => void;
  /** The typed text, untrimmed. The caller decides whether anything changed. */
  onCommit: (raw: string) => void;
  onCancel: () => void;
}

/** A dashed pill — the "tap to add" state. Decorative edge; the words carry the meaning. */
const HINT: CSSProperties = {
  color: "var(--cb-sheet-ink-soft)",
  border: "1px dashed color-mix(in srgb, var(--cb-sheet-ink) 32%, transparent)",
};

export function InlineText(props: InlineTextProps): ReactElement {
  const { region, label, hint, value, editing, busy = false, onEdit } = props;

  if (editing) return <InlineTextField {...props} />;

  if (value.trim() === "") {
    return (
      <button
        type="button"
        data-welcome-edit={region}
        data-state="empty"
        onClick={onEdit}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 transition-colors duration-[var(--dur-fast)] hover:bg-[color-mix(in_srgb,var(--cb-sheet-ink)_5%,transparent)]"
        style={HINT}
      >
        <Plus aria-hidden="true" className="size-4 shrink-0" />
        {hint}
      </button>
    );
  }

  return (
    <button
      type="button"
      data-welcome-edit={region}
      data-state="filled"
      aria-busy={busy || undefined}
      onClick={onEdit}
      /* `-my-2.5 py-2.5`: a 44px target that occupies the line's own height, so the card's
         rhythm is the rhythm a recipient will see. */
      className="-my-2.5 inline cursor-pointer rounded-lg px-2 py-2.5 text-center transition-colors duration-[var(--dur-fast)] hover:bg-[color-mix(in_srgb,var(--cb-sheet-ink)_5%,transparent)]"
      style={{ font: "inherit", color: "inherit", overflowWrap: "anywhere" }}
    >
      <span className="sr-only">{`Edit ${label.toLowerCase()}: `}</span>
      {value}
      <PenLine
        aria-hidden="true"
        className="ms-1.5 inline size-3.5 align-[-0.05em] opacity-60"
      />
    </button>
  );
}

/** How close to the cap the counter appears. Earlier than this it is noise. */
const COUNTER_WITHIN = 60;

function InlineTextField({
  region,
  label,
  placeholder,
  value,
  maxLength,
  multiline = false,
  onCommit,
  onCancel,
}: InlineTextProps): ReactElement {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  /* One commit per editing session. Enter commits and unmounts the field, and a blur can still
     arrive on the way out; without this the same text would be sent twice. */
  const settled = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    el.focus();
    /* Caret at the end, not a selection: the owner is usually adding to what is there. */
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  /* The textarea grows with its text, so a two-line bio is edited as two lines. */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!multiline || el === null) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, multiline]);

  const commit = () => {
    if (settled.current) return;
    settled.current = true;
    onCommit(draft);
  };
  const cancel = () => {
    if (settled.current) return;
    settled.current = true;
    onCancel();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    /* Enter saves in both fields. A bio is one or two lines of running text; a newline in it
       would render as nothing on the card, so Enter is more useful as "done". */
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  const remaining = maxLength - draft.length;
  const counterId = `welcome-${region}-count`;
  const showCounter = multiline && remaining <= COUNTER_WITHIN;

  const fieldStyle: CSSProperties = {
    font: "inherit",
    color: "var(--cb-sheet-ink)",
    background: "color-mix(in srgb, var(--cb-sheet-ink) 4%, var(--cb-sheet))",
    border: "1px solid color-mix(in srgb, var(--cb-sheet-ink) 24%, transparent)",
    textAlign: "center",
  };

  const shared = {
    ref,
    "data-welcome-field": region,
    "aria-label": label,
    placeholder,
    maxLength,
    value: draft,
    enterKeyHint: "done" as const,
    onKeyDown,
    onBlur: commit,
    "aria-describedby": showCounter ? counterId : undefined,
    className: "w-full rounded-lg px-3 py-2 placeholder:text-[var(--cb-sheet-ink-soft)] placeholder:opacity-70",
    style: fieldStyle,
  };

  return (
    <span className="flex w-full flex-col items-stretch gap-1">
      {multiline ? (
        <textarea
          {...shared}
          rows={2}
          onChange={(event) => setDraft(event.target.value.replace(/\n/g, " "))}
          style={{ ...fieldStyle, resize: "none", overflow: "hidden" }}
        />
      ) : (
        <input
          {...shared}
          type="text"
          autoComplete="organization-title"
          onChange={(event) => setDraft(event.target.value)}
        />
      )}
      {showCounter ? (
        <span
          id={counterId}
          aria-live="polite"
          className="self-end font-sans text-xs tabular-nums"
          style={{ color: "var(--cb-sheet-ink-soft)" }}
        >
          {`${remaining} left`}
        </span>
      ) : null}
    </span>
  );
}
