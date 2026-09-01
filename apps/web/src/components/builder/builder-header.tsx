"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useId, type ReactElement } from "react";

import { canBuildVcf } from "@/card/build-vcf";
import { FieldCountMeter } from "@/components/app";
import { NavDrawer } from "@/components/layout";
import { Button } from "@/components/primitives";
import { cn } from "@/lib/cn";
import type { ResolvedCard } from "@/types/domain";

import { EMPTY_CARD_SAVE_REASON } from "./empty-card-warning";

/**
 * The builder's header — back link, the card's name, the field-count meter, and Save.
 *
 * ## Why everything that matters lives here
 *
 * §8D.4's fourth recorded failure: the old build put a product-tour anchor on a **tab panel**,
 * which only exists while that tab is active, so the anchor vanished the moment somebody
 * switched tabs. The rule that came out of it is structural — anything that must always be
 * reachable attaches to the header, because the header is the part of this screen that always
 * exists. The meter and Save are both here for that reason, not for balance.
 *
 * ## Exactly one commit affordance
 *
 * Save, and nothing else. The old builder had "Save details" and "Next" on one screen and no
 * answer to which one the owner had pressed. Every other control on this screen writes straight
 * into the preview, so there is nothing to apply and nothing to advance.
 *
 * ## The Save block, and why it is `aria-disabled` rather than `disabled`
 *
 * AC-36: a card that maps nothing cannot be saved. `canBuildVcf` decides that — the single
 * definition, shared with the meter, `buildVcf`'s `EmptyCardError` and the public page's absent
 * button. A local `fieldCount === 0` here would be a second definition, and the first thing it
 * would get wrong is a links-only card: `fieldCount` counts social links too, so a card sharing
 * three profiles and nothing else is perfectly good and a naive check would refuse it.
 *
 * `<Button>` renders `aria-disabled` and keeps the control focusable, which is the point: a
 * natively disabled button leaves the tab order, and a control nobody can focus is a control
 * whose explanation nobody ever hears. The click guard is real (the component preventDefaults
 * it), so the button is inert without being invisible to a screen reader.
 *
 * ## The name is edited in place
 *
 * There is no rename screen and no rename dialog. The input **is** the name, it updates the
 * preview summary as it is typed, and it is the only text input on the whole builder — which is
 * what makes "no field editor is embedded here" a checkable claim.
 */

export interface BuilderHeaderProps {
  /** The one resolved card (I-5) — the meter and the Save gate both read it. */
  resolved: ResolvedCard;
  name: string;
  /** `null` for a new card: Save creates rather than updates, and the labels say so. */
  cardId: string | null;
  /** Unsaved changes. Shown as a status beside the meter, never as the Save label. */
  dirty: boolean;
  onRename: (name: string) => void;
  onSave: () => void;
  /**
   * True while the save is in flight.
   *
   * Saving is a network round trip now — two of them for a new card — so the button has to
   * announce busy and swallow a second click. Before the API it was synchronous and this prop
   * would have had nothing to report.
   */
  saving?: boolean;
}

export function BuilderHeader({
  resolved,
  name,
  cardId,
  dirty,
  onRename,
  onSave,
  saving = false,
}: BuilderHeaderProps): ReactElement {
  const nameId = useId();
  /** The one gate. Never a local field count — see the module note. */
  const canSave = canBuildVcf(resolved);

  return (
    <header
      data-builder-header=""
      /* ⚠ **One toolbar. It was three stacked rows over a rule.**
         Back link, an "EDITING" overline, a "CARD NAME" label, the name, the meter, the
         saved-state and Save were laid out as a stack — seven pieces of chrome above a screen
         whose subject is a card. They are the same seven pieces, minus the two labels that
         named things already on screen; what changed is that they sit on one line, on one
         surface, so the eye lands on the name.

         A rounded panel rather than a bottom rule, because the controls below are a rounded
         panel and the preview is a rounded device — a full-width hairline across the top of
         both is the one edge on this screen that belongs to no object. */
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-3 rounded-xl border border-line",
        "bg-canvas px-3 py-2.5 shadow-[var(--elevation-1)] sm:px-4",
      )}
    >
      {/* ── the way back out of focus mode ─────────────────────────────────────
          The app's rail is not rendered on this route (see `layout/focus-route.ts` for why an
          editor drops it), so this is the navigation. It is first in the toolbar and the first
          control a keyboard user reaches inside it — the skip link still precedes everything
          (AC-26), as it must. That is the same position the rail's own logo occupies on every
          other screen, which is where a reader goes looking for it. */}
      <NavDrawer />

      <span aria-hidden="true" className="h-6 w-px shrink-0 bg-line" />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* Visually hidden at every width. It stays in the accessibility tree, wired by
            `htmlFor`, so the input is still named — while the words "CARD NAME" printed over a
            field that already reads as a title were one of the seven pieces of chrome this bar
            was carrying. */}
        <label htmlFor={nameId} className="sr-only">
          Card name
        </label>
        {/* Deliberately not `<Input>`: this is the page's title, so it is typographically a
            heading that happens to be editable, rather than a form control in a form. The fill
            appears on hover and focus so it still reads as editable. */}
        <input
          id={nameId}
          data-builder-name=""
          value={name}
          onChange={(event) => onRename(event.target.value)}
          /* A card name is a label on a wallet pass; anything longer is not a name. */
          maxLength={48}
          autoComplete="off"
          spellCheck={false}
          placeholder="Name this card"
          className={cn(
            "w-full min-w-0 rounded-lg bg-transparent px-2 py-1",
            // The display face, at the section-title step — this is the title of the screen and
            // the only thing on the toolbar that should read as one.
            //
            // ⚠ The weight is stated. `globals.css` gives `--weight-semibold` to `h1…h4`
            // *elements*, and this title is an `<input>` — so it takes the size and the family
            // from `.text-h3` and would have taken 400 from the form control, landing a 20px
            // display face at book weight next to a 20px panel title at 560. `font-semibold` is
            // the token (`--font-weight-semibold` → 560), not Tailwind's stock 600.
            "text-h3 font-semibold text-ink placeholder:text-ink-4",
            "transition-colors duration-[var(--dur-fast)]",
            "hover:bg-surface-sunk focus:bg-surface-sunk",
          )}
        />

        {/* The mode, as a chip. Same words the hidden `<h1>` gives a screen reader, so it is
            `aria-hidden` and nobody hears it twice. */}
        <p
          className="hidden shrink-0 rounded-full bg-surface-sunk px-2.5 py-1 text-xs text-ink-3 sm:block"
          aria-hidden="true"
        >
          {cardId === null ? "New" : "Editing"}
        </p>
      </div>

      {/**
       * The page's `<h1>`, visually hidden.
       *
       * The card's name is deliberately an `<input>` rather than a heading — it is the page
       * title *and* the control that edits it, which is right for a screen whose whole model is
       * "every control is live". But it leaves the document with no `<h1>`, so the first heading
       * was a panel's `<h2>` and the outline skipped a level, which is what axe's `heading-order`
       * rule fails on. A visually-hidden heading fixes the outline without putting a second
       * title on screen next to the editable one.
       */}
      <h1 className="sr-only">
        {cardId === null ? "New card" : `Edit ${name.trim().length > 0 ? name : "card"}`}
      </h1>

      <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 sm:w-auto">
        {/* AC-36's persistent meter, reading `canBuildVcf` through `FieldCountMeter`.
            `note={false}`: the warning bar below carries that sentence verbatim, and printing
            it twice on one screen makes neither copy the authority. */}
        <FieldCountMeter resolved={resolved} variant="meter" note={false} />

        {/* Saved-ness is a state, so it is stated as one. It used to be the Save button's
            label — which put the word "Saved" on a card that had never been saved and, on the
            zero-field card, could not be. A button's label is the action it performs. */}
        <p
          data-builder-dirty={dirty ? "true" : "false"}
          className="text-xs text-ink-4"
          role="status"
        >
          {dirty ? "Unsaved" : "Saved"}
        </p>

        {/* The one way back to the card, and it is a link rather than a second Save. On every
            other screen this is the rail's job; in focus mode the toolbar owns it. */}
        <Link
          href={cardId === null ? "/cards" : `/cards/${cardId}`}
          data-builder-back=""
          className={cn(
            "hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-ink-3 sm:inline-flex",
            "transition-colors duration-[var(--dur-fast)] hover:bg-surface-sunk hover:text-ink",
          )}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {cardId === null ? "Cards" : "Back"}
        </Link>

        <Button
          data-builder-save=""
          disabled={!canSave}
          {...(canSave ? {} : { disabledReason: EMPTY_CARD_SAVE_REASON })}
          loading={saving}
          loadingLabel={cardId === null ? "Creating…" : "Saving…"}
          onClick={onSave}
        >
          {cardId === null ? "Create card" : "Save changes"}
        </Button>
      </div>
    </header>
  );
}
