"use client";

import { useId, type ReactElement } from "react";

import { cn } from "@/lib/cn";

import { BUILDER_NEW_CARD_NAME } from "./builder-reducer";

/**
 * The head of the control panel: **the card's name, and one line on what this tab changes.**
 *
 * ## ⚠ THE TITLE IS THE CARD'S NAME NOW, NOT THE SECTION'S — client, 2026-09-07
 *
 * It used to print the section: a `.text-h3` reading "Fields" over an intro, with the card's
 * name in a toolbar input eighty pixels above it. Two problems, and the second is the one that
 * cost something real:
 *
 * · **The panel titled itself after a word already on screen.** The rail's selected tab says
 *   "Fields"; a heading repeating it is a line of chrome that carries no information.
 * · **⚠ Nobody was naming their cards.** The name lived in a heading-shaped `<input>` on the
 *   toolbar — the client's own screenshots show card after card still called "Untitled card".
 *   A control that reads as a title is a control people read rather than use.
 *
 * So the card's name **is** the panel's title, in the working column, at `.text-h2` — a step
 * larger than the heading it replaced, and the first thing the eye lands on inside the panel.
 * The section's name survives as an `sr-only` `<h2>`, which keeps the document outline at
 * 1 → 2 → 3 (axe's `heading-order`) and gives a screen reader the word the rail conveys
 * visually. Client: *"make the title of the card more prominent — perhaps where 'Fields' is, we
 * can put the title of the card."*
 *
 * ## ⚠ RENDERED ONCE, ABOVE THE TAB PANELS — NOT ONCE PER PANEL
 *
 * The card's name is the same on both tabs, so it is not a tab's content. Inside each
 * `Tabs.Content` it would be a *different element per tab*, and Radix renders an inactive panel's
 * children as `present && children` (`react-tabs/dist/index.mjs` — the wrapper `div` stays with
 * `hidden`, its children do not), so switching tab would **unmount the input and mount another
 * one**: caret, selection and focus all gone, mid-rename, for a value that did not change.
 *
 * Hoisting it also makes "exactly one `[data-builder-name]` on the screen" a property of the
 * layout rather than of Radix's mounting rules, which a later `forceMount` would quietly break.
 * `builder-client.tsx` renders this above the panels and passes the *active* section's copy, so
 * there is one name input on the screen at every width and on every tab.
 *
 * ## The intro is capped at a reading measure
 *
 * `max-w-[58ch]`. The panel is ~520px at 1440 and wider on a large screen, and a description
 * set to the full width of a wide panel is a line nobody finishes. It is the only prose on the
 * screen and it is allowed to behave like prose.
 */

export interface PanelHeadProps {
  /**
   * The active section's name — "Fields", "Design".
   *
   * ⚠ Rendered `sr-only`, as the panel's `<h2>`. It is not a visible title: the rail already
   * shows which section is open, and the visible title is the card's name below it.
   */
  section: string;
  /** The card's name, live from the reducer. Never a placeholder-substituted copy of it. */
  name: string;
  onRename: (next: string) => void;
  /** One sentence on what this panel changes. From `BUILDER_SECTIONS`, never retyped. */
  intro: string;
  className?: string;
}

export function PanelHead({
  section,
  name,
  onRename,
  intro,
  className,
}: PanelHeadProps): ReactElement {
  const nameId = useId();

  return (
    <div data-panel-head="" className={cn("flex flex-col gap-1.5", className)}>
      {/* The outline's second level. Visually hidden because the rail is the visible copy —
          see the module note on why this is not a `<span>`: without it the group labels in the
          field list would be `<h3>`s under an `<h1>`, which is the skip axe fails on. */}
      <h2 className="sr-only">{section}</h2>

      <label htmlFor={nameId} className="sr-only">
        Card name
      </label>
      {/* ⚠ Deliberately not `<Input>`: this is the panel's title, so it is typographically a
          heading that happens to be editable, rather than a form control in a form. */}
      <input
        id={nameId}
        data-builder-name=""
        value={name}
        onChange={(event) => onRename(event.target.value)}
        /**
         * ⚠ SELECT THE UNTOUCHED DEFAULT, SO TYPING REPLACES IT.
         *
         * A new card is pre-filled with `BUILDER_NEW_CARD_NAME` because `CreateCardDto.name` is
         * required — so the field is never empty, the `placeholder` below is never seen, and
         * tapping the title drops a caret into the middle of "Untitled card" and asks the owner
         * to delete thirteen characters before they can type their own. That is enough friction
         * to explain a whole app full of cards called "Untitled card".
         *
         * Selecting **only** the exact default is the narrow version of the fix: a real name is
         * never auto-selected, so a one-character correction to "Work — Kestrel" is not one
         * keystroke away from being wiped.
         */
        onFocus={(event) => {
          if (event.target.value === BUILDER_NEW_CARD_NAME) event.target.select();
        }}
        /* A card name is a label on a wallet pass; anything longer is not a name. */
        maxLength={48}
        autoComplete="off"
        spellCheck={false}
        placeholder="Name this card"
        className={cn(
          "w-full min-w-0 rounded-lg bg-transparent px-2.5 py-1.5",
          /* ⚠ `text-ellipsis` on an `<input>`, and it does real work here. A 48-character name
             in a narrow panel simply ran off the right edge and stopped — a hard cut mid-glyph
             with no signal that there was more. `text-overflow: ellipsis` applies to a text
             input while it is NOT focused in every engine that matters, so the name reads as
             "Work — Kestrel Telecom, ne…" at rest and reverts to normal scrolling the moment
             it is tapped, which is exactly what you want from a field you are about to edit. */
          "text-ellipsis",
          /* ⚠ `.text-h2`, a step ABOVE the `.text-h3` this replaced. `globals.css` binds the
             `.text-h*` scale to `--font-display` (Space Grotesk), so the title differs from the
             body in *family* as well as size — a change the eye reads before it reads a word,
             and the one typographic event on the screen.

             The weight is stated: `globals.css` gives `--weight-semibold` to `h1…h4`
             *elements*, and this is an `<input>`, so it would take 400 from the form control
             and land a display face at book weight. `font-semibold` is the token (560). */
          "text-h2 font-semibold text-ink placeholder:text-ink-4",
          "transition-colors duration-[var(--dur-fast)]",
          /**
           * ⚠ A RESTING BOUNDARY, NOT HOVER-ONLY.
           *
           * **There is no hover on a touch screen**, so a fill that only appears on `hover:`
           * and `focus:` is no affordance at all on a phone — which is most of why cards kept
           * their default name. A hairline at rest is the smallest thing that says "field": it
           * keeps the title reading as a title, and `--line` is decorative-weight so it does
           * not compete with the panel's own edges. Hover and focus deepen it.
           */
          "border border-line",
          "hover:border-line-control hover:bg-surface-sunk",
          "focus:border-ink-4 focus:bg-surface-sunk focus:outline-none",
        )}
      />

      <p data-prose className="max-w-[58ch] px-2.5 text-sm text-ink-3">
        {intro}
      </p>
    </div>
  );
}
