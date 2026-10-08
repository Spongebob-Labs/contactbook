"use client";

import Link from "next/link";
import { useEffect, useMemo, type CSSProperties } from "react";

import { canBuildVcf } from "@/card/build-vcf";
import { CardPage, cardPageSurface } from "@/card/card-page";
import { paletteVars } from "@/card/template-palettes";
import { PublicCardActions } from "@/components/public-card/public-card-actions";
import { resolveCard } from "@/card/resolve-card";
import { ErrorPanel } from "@/components/data/error-panel";
import { LoadingSkeleton } from "@/components/data/loading-skeleton";
import { ScreenStateRoot, resolveDataScreenState } from "@/components/data/screen-state-root";
import { hasWhatsAppAction } from "@/components/public-card/whatsapp-button";
import { useFixture } from "@/lib/fixture-gateway";
import type { ContactCard } from "@/types/domain";

/**
 * `/c/[slug]` — **the screen the whole product exists for** (spec §8D.5, §4.2).
 *
 * A stranger points a phone camera at a QR code and lands here. There is **no session, no
 * stored state and nothing to assume**: the slug in the URL is the entire input. Everything
 * below is written from that position, which is also why the page carries no chrome — no
 * sidebar, no bottom bar, no marketing nav — and offers exactly one way out, "Made with
 * Contact Book".
 *
 * ## The six things this component decides
 *
 * 1. **It resolves the card once, and hands that one object to everything.** `resolveCard`
 *    runs in a `useMemo`, and the same reference reaches `<ShareFace>` and the `.vcf`
 *    writer (I-5). Resolving a second time for the download is the old build's bug where the
 *    previewed card and the sent file differed.
 *
 * 2. **It renders no action buttons.** `<ShareFace>` paints both inside the card
 *    skeleton, because the action row is part of §8B.1's anatomy and AC-20 counts exactly
 *    two per `full` card. This component supplies the *behaviour* — `onSaveToContacts` and
 *    `savePending` — and nothing else. `save-to-contacts-button.tsx` and
 *    `whatsapp-button.tsx` are where those two contracts live.
 *
 * 3. **`canBuildVcf(resolved)` decides whether the card shares anything**, never an inline
 *    `fieldCount` comparison. It is T11's single definition, and E-02 hangs off it: on a
 *    zero-field card the Save control is **not rendered at all**, so `buildVcf` — which
 *    throws `EmptyCardError` — is never called and the 73-byte name-only `.vcf` of §11.6
 *    cannot be produced. Not disabled. Absent.
 *
 * 4. **The empty state family here means "this card shares nothing".** §8D.5 defines it that
 *    way, so `resolveDataScreenState` is fed `isEmpty: !canBuildVcf(resolved)` rather than
 *    "the collection is short". Two very different routes reach it and both are correct:
 *    `card_empty_demo` maps no fields, and `?state=empty` empties the profile the card
 *    filters (§11 E-08), which produces the same card with the same consequence.
 *
 * 5. **It is the one consumer that asks for the FIXED ground.** `[data-card-page-surface]` on
 *    the column below is what `card.css` keys `position: fixed` off, and the polarity is
 *    deliberate: a fixed layer escapes any ancestor that is not a containing block, and
 *    `overflow` does not make one, so a ground that were fixed by default would break out of
 *    the builder's scrolled preview frame and paint the whole browser viewport. The safe
 *    rendering is the default; this screen — a whole document, with nothing above it — is the
 *    only place that opts in. See the head of `card-ground.tsx`.
 *
 * 6. **Masked stays masked.** T12 already stripped every masked row's `href` and its raw
 *    `title`; AC-33 is defeated by *adding* something back. There is no reveal control on
 *    this page and there is no prop to add one — reveal lives only in `/profile`, behind a
 *    per-field toggle that resets on navigation (§7.3). This page is unauthenticated, so a
 *    revealed account number is a published one.
 *
 * ## Layout (§8D.5)
 * ≤767px the card fills the viewport minus `--space-3` a side, floored at its own 336px
 * minimum; ≥768px it sits centred at its 400px design width with a single caption beneath.
 * The vertical rule is "centred when it fits, top-aligned and scrollable when it does not",
 * which is `margin-block: auto` on the column rather than `justify-content: center` —
 * centring by justification clips the overflowing top and puts it out of scroll reach.
 */

export interface PublicCardViewProps {
  /**
   * The card the slug addresses, resolved on the server so `generateMetadata` and the
   * not-found boundary can agree with what renders here (§11 E-37).
   */
  card: ContactCard;
}

/** §11 E-02's caption. Shown wherever the card turns out to share nothing. */
const EMPTY_NOTE = "This card doesn't share any details yet.";

/**
 * The document scrollbar, while a card page is on screen.
 *
 * ⚠ It has to be set on `documentElement` and there is no way around that: the viewport's
 * scrollbar belongs to the document element, the card's colours arrive as `--c-*` custom
 * properties declared on the **card root**, and a custom property cannot travel upward. So two
 * resolved values are lifted onto `:root` for as long as this view is mounted, and removed on
 * unmount — `card.css` matches `:root[data-card-page-scroll]` and matches nothing anywhere
 * else in the app.
 *
 * A `<style>` tag would have been fewer lines and is the wrong tool: React 19 hoists those into
 * `<head>` and does **not** remove them again, so navigating away from a card would leave an
 * onyx scrollbar on the dashboard.
 *
 * The colours are hex read straight off the palette rather than `var()`, because `:root` is
 * outside the card and the variables genuinely are not defined there. `ink` at 34% of the
 * ground is a thumb that reads on both polarities by construction — it is the same ink the
 * contract already proved at 7:1 on that ground, at a third of the strength.
 */
function useCardScrollbar(thumb: string | null, track: string | null): void {
  useEffect(() => {
    if (thumb === null || track === null) return;
    const root = document.documentElement;
    root.dataset.cardPageScroll = "";
    root.style.setProperty("--cb-scroll-thumb", thumb);
    root.style.setProperty("--cb-scroll-track", track);
    return () => {
      delete root.dataset.cardPageScroll;
      root.style.removeProperty("--cb-scroll-thumb");
      root.style.removeProperty("--cb-scroll-track");
    };
  }, [thumb, track]);
}

export function PublicCardView({ card }: PublicCardViewProps) {
  // The whole database, not a slice: `FIXTURE_DB` and `EMPTY_FIXTURE_DB` are module
  // constants, so `data` is referentially stable and the memo below actually memoises.
  const { state, data, error } = useFixture((db) => db);

  const resolved = useMemo(
    () => (data === null ? null : resolveCard(card, data.user, data.groups, data.fields)),
    [card, data],
  );

  const canSave = resolved !== null && canBuildVcf(resolved);
  const canMessage = resolved !== null && hasWhatsAppAction(resolved);

  const screenState = resolveDataScreenState({
    state,
    // §8D.5: "empty" on this screen is a card that shares nothing, not a short list.
    isEmpty: resolved !== null && !canSave,
  });

  const showCard = resolved !== null && (screenState === "success" || screenState === "empty");

  /* One resolution of the card's look, shared with the card itself and with its two actions.
     `painted` is false only on the `minimal` layout, whose whole definition is that there is
     no coloured ground — so the caption below it, and the scrollbar beside it, stay on the app
     chrome's own greys rather than borrowing an ink chosen for a colour that is not there. */
  const surface = resolved === null ? null : cardPageSurface(resolved);
  const painted = showCard && surface !== null && true;
  const palette = resolved?.palette ?? null;

  useCardScrollbar(
    !painted || palette === null
      ? null
      : `color-mix(in srgb, ${palette.ink} 34%, ${palette.ground})`,
    !painted || palette === null ? null : palette.ground,
  );

  /* ⚠ `position: relative` is not decoration on these two captions.
     The ground is a positioned element with `z-index: 0`, and CSS paints positioned
     descendants ABOVE the in-flow text of their siblings. A static caption after the card
     would therefore be painted over by the fixed ground and simply vanish. Giving it a
     position puts it in the same paint step, after the ground, in tree order. */
  const captionStyle: CSSProperties = {
    position: "relative",
    zIndex: 1,
    color: painted ? "var(--c-ink-soft)" : "var(--ink-3)",
  };

  return (
    <ScreenStateRoot
      state={screenState}
      data-public-card={card.id}
      // §13.2's shape: which of the two actions this page is offering, so the E-02 and
      // E-56 assertions read a positive value instead of inferring from an absent node.
      data-public-card-actions={
        [canSave ? "save" : null, canMessage ? "whatsapp" : null].filter(Boolean).join(" ")
      }
      className="flex min-h-full flex-1 flex-col items-center bg-canvas"
    >
      <div
        /* ⚠ THE OPT-IN. `card.css` promotes `[data-card-ground]` to `position: fixed` only
           under this attribute — see responsibility 5 above. */
        data-card-page-surface=""
        /* The palette, one level above the card, so the captions BELOW the card (which stand
           on the fixed ground, not on the app canvas) can read the same `--c-*` properties the
           card does. Idempotent: the card root declares them again for itself. */
        style={palette === null ? undefined : (paletteVars(palette) as CSSProperties)}
        className="flex w-full max-w-[480px] flex-col items-center gap-4"
      >
        {screenState === "loading" ? (
          <LoadingSkeleton variant="card" label="Loading this contact card" />
        ) : null}

        {screenState === "error" || screenState === "offline" ? (
          // §6.10, and the one difference a public route makes: the way out is "Go home",
          // never "Go to dashboard". Whoever is reading this has no dashboard.
          <ErrorPanel error={error} headingLevel={1} homeHref="/" homeLabel="Go home" />
        ) : null}

        {showCard && resolved !== null ? (
          <>
            {/* The card's own `<h2>` carries the name; this gives the page the level-1
                heading a document needs without repeating the name as visible text. */}
            <h1 className="sr-only">{`Contact card for ${resolved.fullName}`}</h1>

            {/* The scan destination renders the PAGE variant, not the face. This is the
                surface a scanned QR lands on, so it must show every field the owner mapped
                — which is only possible on an object with no fixed height. The face is the
                compact artefact you hand over; this is what it resolves to. */}
            <CardPage
              resolved={resolved}
              actions={
                <PublicCardActions />
              }
            />

            {canSave ? null : (
              <p
                data-public-card-empty-note=""
                style={captionStyle}
                className="text-center text-xs"
              >
                {EMPTY_NOTE}
              </p>
            )}

            {/* §8D.5: one caption line, ≥768px only. Below that the viewport belongs to
                the card, and the fields are what the reader came for. (They came here *by*
                a QR; there is deliberately no second QR on this page — see the note at the
                head of `card-page.tsx`.) */}
            <p
              data-public-card-made-with=""
              style={captionStyle}
              className="hidden text-center text-xs md:block"
            >
              {/* No `underline-offset-2` utility any more: `card.css` states the offset AND
                  the thickness for every link on this surface, so the one link on the page
                  cannot disagree with the rule that governs the rest of it. */}
              <Link href="/" className="underline">
                Made with Contact Book
              </Link>
            </p>
          </>
        ) : null}
      </div>
    </ScreenStateRoot>
  );
}
