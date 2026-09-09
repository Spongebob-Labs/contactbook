"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactElement } from "react";

import { canBuildVcf } from "@/card/build-vcf";
import { FieldCountMeter } from "@/components/app";

import { NavDrawer } from "@/components/layout";
import { Button } from "@/components/primitives";
import { cn } from "@/lib/cn";
import type { ResolvedCard } from "@/types/domain";

import { EMPTY_CARD_SAVE_REASON } from "./empty-card-warning";

/**
 * The builder's header — back link, the card's name as context, the field-count meter, and
 * Save. The name is *edited* one level down, in the control panel's head.
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
 * ## ⚠ The name is NOT edited here any more
 *
 * There is still no rename screen and no rename dialog — the input **is** the name and it
 * updates the preview summary as it is typed. What moved is *where* it is: it heads the control
 * panel (`panel-head.tsx`), where the owner is already working, because as a toolbar input it
 * went unnoticed and cards shipped called "Untitled card". This bar shows the name as context
 * and carries no text input at all, which keeps "no field editor is embedded in the header" a
 * checkable claim about the part of the screen that always exists.
 */

export interface BuilderHeaderProps {
  /** The one resolved card (I-5) — the meter and the Save gate both read it. */
  resolved: ResolvedCard;
  name: string;
  /** `null` for a new card: Save creates rather than updates, and the labels say so. */
  cardId: string | null;
  /** Unsaved changes. Shown as a status beside the meter, never as the Save label. */
  dirty: boolean;
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
  onSave,
  saving = false,
}: BuilderHeaderProps): ReactElement {
  /** The one gate. Never a local field count — see the module note. */
  const canSave = canBuildVcf(resolved);

  return (
    <header
      data-builder-header=""
      /* ⚠ **One toolbar. It was three stacked rows over a rule.**
         Back link, an "EDITING" overline, a "CARD NAME" label, the name, the meter, the
         saved-state and Save were laid out as a stack — seven pieces of chrome above a screen
         whose subject is a card. They are the same pieces, minus the two labels that named
         things already on screen and minus the name input itself (it heads the control panel
         now); what changed is that they sit on one line, on one surface.

         A rounded panel rather than a bottom rule, because the controls below are a rounded
         panel and the preview is a rounded device — a full-width hairline across the top of
         both is the one edge on this screen that belongs to no object. */
      className={cn(
        "flex flex-wrap items-center gap-x-3 rounded-xl border border-line",
        /* ⚠ The row gap is tighter on a phone, and it is not a cosmetic tightening.
           This toolbar WRAPS below `sm` — the title takes one line and the meter/Save block
           takes another — so `gap-y-3` plus `py-2.5` twice made it 110px tall. On a 640px
           Android that is 17% of the viewport spent on chrome, above a 243px preview, leaving
           the panel the reader is actually working in about 223px. 8px of row gap and 8px of
           vertical padding give 20px back without crowding anything: the two rows are still
           clearly two rows. From `sm` up it does not wrap at all, so the original rhythm is
           restored there rather than compromised everywhere. */
        "gap-y-2 py-2 sm:gap-y-3 sm:py-2.5",
        "bg-canvas px-3 shadow-[var(--elevation-1)] sm:px-4",
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
        {/**
         * ⚠ **THE NAME IS READ-ONLY HERE NOW, AND IT IS EDITED IN THE PANEL'S HEAD.**
         *
         * This was the editable title: a `.text-h3` `<input>` on the toolbar. It worked and
         * almost nobody used it — the client's screenshots show card after card still called
         * "Untitled card" — because a control that reads as a title is a control people read
         * rather than use, and on the toolbar it sits *outside* the column they are working in.
         *
         * So `panel-head.tsx` owns the input, at `.text-h2`, as the head of the control panel;
         * this is the same string as quiet context, the way a document's top bar shows the title
         * you edit in the page. **One input for one value** — a second one bound to the same
         * reducer field would be two places to look and two places to fix.
         *
         * ⚠ `onRename` came off `BuilderHeaderProps` with the input rather than being left on
         * it unused. A prop nobody calls is a prop the next reader has to prove is dead; the
         * rename handler now goes to `<PanelHead>`, from the same one line in
         * `builder-client.tsx`.
         */}
        <p
          data-builder-name-label=""
          className="min-w-0 flex-1 truncate px-1 text-sm font-medium text-ink-2"
        >
          {name.trim().length > 0 ? name : "Name this card"}
        </p>

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
