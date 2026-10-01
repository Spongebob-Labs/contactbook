"use client";

import { ChevronDown, Pencil, Plus } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
} from "react";

import { BIO_MAX, HEADLINE_MAX } from "@/components/builder/design-panel";
import { BUILDER_SCROLL_CLEAR } from "@/components/builder/scroll-clear";
import { Button } from "@/components/primitives";
import { cn } from "@/lib/cn";

/**
 * **Position & bio** — the two lines printed under the name, as the first section of the Fields
 * panel.
 *
 * Client, 2026-09-30: *"Position and bio should not be in the design section. They should be in
 * the field section,"* present without being asked for. So they are rows here from the start, in
 * the same rhythm as every other row, and the Design panel keeps only the logo and the cover.
 *
 * ## They belong to the card, not to the profile
 *
 * `headline` and `bio` are `Card` columns: each card has its own, and there is nothing to tick.
 * The section says which card it is writing to where the other sections say "On card", the same
 * way the company logo row says it. A write goes through `useCardDesign` — one debounced
 * `PATCH /cards/{id}` — so it shares the one status line above the card.
 *
 * ## An empty row still says what the card shows
 *
 * With no position of its own a card prints the first job title on it, and with no bio it may
 * compose one from the profile. An empty row that read "Add position" while the card beside it
 * said "Software engineer" would be the screen contradicting itself, so an empty row shows the
 * line the card is actually printing, quietly, with where it came from. Both come off the
 * workspace's one resolution (I-5); nothing here derives them again.
 */

export interface WorkspaceCardIntroProps {
  cardName: string;
  /** The card's own values — `""` when it has none. */
  headline: string;
  bio: string;
  /** What the card prints when its own value is empty, off the one resolution. */
  fallbackHeadline: string | null;
  fallbackBio: string | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onHeadline: (headline: string) => void;
  onBio: (bio: string) => void;
}

export function WorkspaceCardIntro({
  cardName,
  headline,
  bio,
  fallbackHeadline,
  fallbackBio,
  open,
  onOpenChange,
  onHeadline,
  onBio,
}: WorkspaceCardIntroProps): ReactElement {
  const panelId = `${useId()}-panel`;

  return (
    <section
      data-workspace-card-intro=""
      data-section-open={open ? "true" : "false"}
      className="border-t border-line"
    >
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          data-card-intro-toggle=""
          onClick={() => onOpenChange(!open)}
          className={cn(
            "flex min-h-14 w-full items-center gap-2 px-3 text-left sm:px-4",
            BUILDER_SCROLL_CLEAR,
          )}
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-5 shrink-0 text-ink-3 transition-transform duration-[var(--dur-fast)] ease-out",
              open ? "rotate-0" : "-rotate-90",
            )}
          />
          <span className="min-w-0 flex-1 text-base font-medium text-ink">Position &amp; bio</span>
          {open ? (
            <span
              data-card-intro-scope=""
              className="max-w-[50%] truncate text-overline uppercase text-ink-3"
            >
              Only on {cardName}
            </span>
          ) : null}
        </button>
      </h2>

      <div id={panelId} hidden={!open} className="pb-2">
        <ul className="flex flex-col">
          <CardTextRow
            rowId="headline"
            label="Position"
            value={headline}
            fallback={fallbackHeadline}
            fallbackNote="from your job title"
            placeholder={fallbackHeadline ?? "Founder & CEO"}
            maxLength={HEADLINE_MAX}
            onSave={onHeadline}
          />
          <CardTextRow
            rowId="bio"
            label="Bio"
            value={bio}
            fallback={fallbackBio}
            fallbackNote="from your profile"
            placeholder="Partnerships lead, based in Mumbai."
            maxLength={BIO_MAX}
            multiline
            onSave={onBio}
          />
        </ul>
      </div>
    </section>
  );
}

/**
 * One card-level text row. `WorkspaceFieldRow`'s shape — press to edit in place, Enter or Save
 * commits, Escape cancels, leaving commits — with the two differences a card column needs: it may
 * be emptied (that clears it and the card falls back), and the bio is a paragraph, not a line.
 */
function CardTextRow({
  rowId,
  label,
  value,
  fallback,
  fallbackNote,
  placeholder,
  maxLength,
  multiline = false,
  onSave,
}: {
  rowId: "headline" | "bio";
  label: string;
  value: string;
  fallback: string | null;
  fallbackNote: string;
  placeholder: string;
  maxLength: number;
  multiline?: boolean;
  onSave: (value: string) => void;
}): ReactElement {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const openRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const restoreFocus = useRef(false);
  const inputId = useId();

  const own = value.trim();
  const inherited = own === "" && fallback !== null && fallback.trim() !== "" ? fallback : null;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      openRef.current?.focus();
    }
  }, [editing]);

  function open() {
    setDraft(value);
    setEditing(true);
  }

  function stop(refocus: boolean) {
    restoreFocus.current = refocus;
    setEditing(false);
  }

  function commit(refocus: boolean) {
    if (draft.trim() !== own) onSave(draft.trim());
    stop(refocus);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commit(true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      stop(true);
      return;
    }
    /* A bio is a paragraph but not a document: Enter saves it, as it does every other row. */
    if (multiline && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commit(true);
    }
  }

  const inputClass = cn(
    "min-w-0 flex-1 rounded-md border border-line-control bg-canvas px-3",
    "text-sm text-ink placeholder:text-ink-4 focus:border-accent focus:outline-none",
    BUILDER_SCROLL_CLEAR,
  );

  return (
    <li
      data-card-intro-row={rowId}
      {...(own === "" ? { "data-card-intro-row-blank": "" } : {})}
      {...(editing ? { "data-card-intro-row-editing": "" } : {})}
      className="flex min-h-14 items-center gap-2 border-t border-line px-3 first:border-t-0 sm:px-4"
    >
      {editing ? (
        <form
          data-card-intro-form=""
          onSubmit={onSubmit}
          onKeyDown={onKeyDown}
          onBlur={(event) => {
            const next = event.relatedTarget;
            if (next instanceof Node && event.currentTarget.contains(next)) return;
            commit(false);
          }}
          className="flex min-w-0 flex-1 flex-col gap-2 py-3"
        >
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={inputId} className="text-xs text-ink-3">
              {label}
            </label>
            <span aria-hidden="true" className="text-xs tabular-nums text-ink-4">
              {draft.length}/{maxLength}
            </span>
          </div>

          <div
            className={cn(
              "flex min-w-0 flex-col gap-2",
              multiline ? "sm:items-start" : "sm:flex-row sm:items-center",
            )}
          >
            {multiline ? (
              <textarea
                ref={inputRef}
                id={inputId}
                data-card-intro-input={rowId}
                value={draft}
                rows={3}
                maxLength={maxLength}
                placeholder={placeholder}
                onChange={(event) => setDraft(event.target.value)}
                className={cn(inputClass, "w-full resize-none py-2 leading-relaxed")}
              />
            ) : (
              <input
                ref={inputRef}
                id={inputId}
                data-card-intro-input={rowId}
                type="text"
                value={draft}
                maxLength={maxLength}
                placeholder={placeholder}
                autoComplete="off"
                onChange={(event) => setDraft(event.target.value)}
                className={cn(inputClass, "h-10")}
              />
            )}
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="submit"
                data-card-intro-save=""
                className={BUILDER_SCROLL_CLEAR}
                onMouseDown={(event) => event.preventDefault()}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={BUILDER_SCROLL_CLEAR}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => stop(true)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <button
          ref={openRef}
          type="button"
          data-card-intro-open={rowId}
          onClick={open}
          className={cn(
            "group -mx-2 flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-md px-2 py-2.5 text-left",
            "transition-colors duration-[var(--dur-fast)] hover:bg-surface/70",
            BUILDER_SCROLL_CLEAR,
          )}
        >
          <span className="max-w-full truncate text-xs text-ink-3">{label}</span>
          <span className="flex min-w-0 max-w-full items-center gap-1.5">
            {own !== "" ? (
              <>
                <span
                  data-card-intro-value=""
                  className={cn("min-w-0 text-sm text-ink", multiline ? "line-clamp-2" : "truncate")}
                >
                  {own}
                </span>
                <Pencil
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 shrink-0 text-ink-4 transition-opacity duration-[var(--dur-fast)]",
                    "md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100",
                  )}
                />
              </>
            ) : inherited !== null ? (
              <span
                data-card-intro-fallback=""
                className="flex min-w-0 max-w-full items-baseline gap-1.5 text-sm text-ink-3"
              >
                <span className={cn("min-w-0", multiline ? "line-clamp-2" : "truncate")}>
                  {inherited}
                </span>
                <span className="shrink-0 text-xs text-ink-4">· {fallbackNote}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-ink-3">
                <Plus aria-hidden="true" className="size-3.5 shrink-0" />
                Add {label.toLowerCase()}
              </span>
            )}
          </span>
        </button>
      )}
    </li>
  );
}
