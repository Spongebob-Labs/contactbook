import type { ReactElement } from "react";

import { ArrowRight, SmartphoneNfc } from "lucide-react";

import { canBuildVcf } from "@/card/build-vcf";
import { CardActionButton } from "@/card/card-action-button";
import { CardPage } from "@/card/card-page";
import { paletteVars } from "@/card/template-palettes";
import { resolveCard } from "@/card/resolve-card";
import { FIXTURE_DB } from "@/fixtures";
import { heroCard, marketingUser } from "@/fixtures/marketing";

import { mkcn } from "./mk-cn";

/**
 * THE HERO'S CARD — the real card page, not the wallet pass.
 *
 * ## ⚠ Rebuilt 2026-09-20. `<ShareFace mode="full">` is gone from this file
 *
 * The hero used to flip between a real `<ShareFace>` (the 336×500 wallet pass, QR included) and
 * `<LiveCard>`, an animated look-alike of the card the QR opens. Both are gone. The product's
 * own redesign moved the card's primary presentation to the **card page** (`@/card/card-page`)
 * — see that file's header — and `card-page-thumb.tsx`'s header makes the same argument for why
 * that page, not the wallet pass, belongs wherever a reader forms their first impression of a
 * card: "the card page is what a recipient actually opens and what an owner means by 'my card'."
 * That argument holds for the hero at least as much as it holds for a `/dashboard` tile.
 *
 * Two things followed from that, not just one:
 *
 *   1. **No QR.** `<CardPage>` has never carried one (see its own header) — a page reached by
 *      scanning a code has no reason to show that code again. So the flip's entire premise ("the
 *      thing you hand over" vs. "the thing it opens") collapsed to one object, because the card
 *      page IS both now: showing it directly is more honest than showing a pass for a QR this
 *      composition does not have. `tests/e2e/qr-scannability.spec.ts` restates the decode
 *      guarantee at `/cards/{id}`, where the wallet pass still lives, unchanged.
 *   2. **No flip.** A flip whose back is a live-updating card and whose front is now *also* a
 *      card is two near-identical objects trading places, not "what you hand over" vs. "what
 *      they see." The reference shows one still card. See "What this drops" below for the one
 *      piece of the old motion this file does not try to recreate, and why.
 *
 * ## Why this component resolves its own fixture instead of taking `resolved` as a prop
 *
 * The previous version took a server-rendered `<ShareFace>` as a `face` prop, because it had to
 * cross a client boundary — `<FlipCard>` owned a timer and a press, so `<HeroCard>` was a client
 * component and `resolveCard`/the QR had to run upstream, in `hero.tsx`, on the server. There is
 * no client state left in this file at all (no flip, no timer), so that boundary does not exist
 * any more. Resolving `heroCard` here — the exact fixture triad `docs/landing-integration.md`
 * names (`marketingUser`, `heroCard`, `FIXTURE_DB`), through the product's own `resolveCard` —
 * keeps every fact about *which* card the hero shows inside the one file that owns the hero's
 * card, instead of spread across this file and `hero.tsx`. `hero.tsx` (Agent E's file, a
 * parallel pass this round) now only needs `<HeroCard />`; see the note at the bottom of this
 * file for the small edit that leaves for it to make.
 *
 * ## Why the card is wrapped `inert` rather than `aria-hidden`
 *
 * The wallet pass had no interactive content, so wrapping it in `aria-hidden` (as `<FlipCard>`
 * did to both of its faces) was safe. `<CardPage>` is not decorative — it renders a real `<a>`
 * per actionable field and a real "Send to Phone" button. `aria-hidden` on an ancestor of a
 * focusable element is a WCAG violation in its own right (a keyboard user tabs into a control no
 * screen reader announces), which is exactly the trap `card-page-thumb.tsx` documents and avoids
 * with `inert`. This hero card is a preview of the product on fixture data, not a real card a
 * visitor can save or message — so it takes the same fix: `inert` removes the whole subtree from
 * both the tab order and the accessibility tree, and a sighted-only `<figcaption>` describes the
 * picture in its place.
 *
 * ## The width, and why it is 336px again without being coupled to `<ShareFace>`
 *
 * `<CardPage>` is fluid (`width: 100%`) — it has no format of its own the way the wallet pass
 * did, so *something* between the phone frame and the card has to give it a definite width.
 * 336 is not reused because it was the wallet pass's — importing `FACE_WIDTH` here would say
 * this card is still shaped by the QR's format, which is precisely what stopped being true. It
 * is reused because `hero.tsx`'s own `-mx-3` compensation (see its comment on the card's column)
 * already budgets exactly 336px of a 360px mobile viewport for whatever this file renders, and
 * that budget belongs to `hero.tsx`, which is not this round's file to move. Changing this
 * number without changing that one reopens the sideways-scroll defect the compensation exists to
 * close.
 *
 * ## What this drops, on purpose, and the one thing it might be worth keeping
 *
 * The auto-cycling flip is gone outright — a still card is what the reference shows, and this
 * file does not try to recreate the "corrected in place" motion `<LiveCard>` performed, because
 * doing so honestly would mean animating a row inside `<CardPage>` itself, which this round's
 * contract holds read-only ("read it, render it, never edit it"). Faking that motion from
 * outside — reaching into the rendered DOM to mutate a row's text — is the "hand-built fake
 * card" this file is specifically told not to be, aimed at a component that can be rebuilt under
 * it at any time. If the single field-updating claim is still wanted here, it is a `<CardPage>`
 * feature (an optional "just changed" row treatment) for whoever owns `src/card/**` to add, not
 * something this file should simulate from the outside.
 *
 * ## The action button is a look-alike, not the real one
 *
 * Same reasoning as `card-page-thumb.tsx` and `builder-preview.tsx`'s `InertActions`: the real
 * `<PublicCardActions>` writes a `.vcf` through a blob URL on click, which has no honest meaning
 * against fixture data on the marketing site. This renders the same `<CardActionButton>` the
 * product ships, with the product's own current label ("Send to Phone", `public-card-actions.tsx`),
 * so the hero shows what the button looks like without pretending a click does anything — and the
 * whole card being `inert` means nobody can try.
 */

/**
 * The phone screen's content width, in px.
 *
 * ⚠ See the module note above: this is `hero.tsx`'s mobile budget, not the wallet pass's format.
 * If that file's `-mx-3` compensation is ever re-derived, this constant has to move with it.
 */
const SCREEN_WIDTH = 336;

/**
 * A hand-written description, not fixture copy. `fixtures/marketing.ts` is locked for this round
 * ("the copy you need exists... if you need a new field, STOP and report it"), and every string
 * it already carries for this card (`hero.cardFrontLabel`, `cardBackLabel`, `cardHint`,
 * `liveCard.caption`) describes the flip this file no longer has. This is the one honest
 * sentence a screen-reader user needs in its place; promoting it into the fixture (so copy edits
 * do not require a code change) is a reasonable follow-up for whoever owns that file next.
 */
const CAPTION = "An example contact card, showing the fields its owner has chosen to share.";

export interface HeroCardProps {
  className?: string;
}

/**
 * One resolve, at module scope — the same triad `hero.tsx` used to assemble upstream.
 *
 * ⚠ Hoisted out of the component so {@link HERO_CARD_SHEET} can read it. The fixture is static
 * and `resolveCard` is pure, so this is the same work done once per process instead of once per
 * render — and, more to the point, it means the card and the phone around it cannot come to
 * different answers about what colour this card's paper is.
 */
const HERO_RESOLVED = resolveCard(heroCard, marketingUser, FIXTURE_DB.groups, FIXTURE_DB.fields);

/**
 * The hero card's own paper, exported for `<PhoneFrame screenTint>`.
 *
 * The phone's screen fades its bottom edge out so the clip does not sever a row of icons
 * against the bezel (see `phone-frame.tsx`), and that fade has to end in **this** colour: the
 * screen's own background is `--mk-white` while this card is cream, so a veil ending in white
 * would paint a pale band across a warm card.
 *
 * Read through `paletteVars` rather than off the palette object, because `--c-sheet` is a
 * *resolved* value — the palette's own `sheet` when it states one, else white carrying 3% of its
 * ground — and that rule lives in exactly one place (`template-palettes.ts`). Reaching past it
 * to `palette.sheet` would be right for this fixture and silently wrong for eight of the nine.
 */
export const HERO_CARD_SHEET = paletteVars(HERO_RESOLVED.palette)["--c-sheet"];

export function HeroCard({ className }: HeroCardProps): ReactElement {
  const resolved = HERO_RESOLVED;
  const shape = resolved.template.shape.buttonShape;

  /* `h-full` on the figure exists only so the `minHeight: "100%"` on the card box below has a
     definite height to resolve against: this figure is the one box between
     `.mk-phone-frame__screen` — which has a definite height, from its aspect ratio — and the
     card. Without it the percentage resolves against an auto-height parent and does nothing. */
  return (
    <figure className={mkcn("mx-auto h-full", className)}>
      <div
        /* The stable hook other code locates the hero's card by. Kept from the flip era on
           purpose (see the report on this round) — it used to mark a `<button>`; it marks a
           plain, `inert` box now, which is the honest shape of a non-interactive preview. */
        data-hero-card=""
        inert
        className="overflow-hidden rounded-mk-block"
        /**
         * ⚠ `minHeight: "100%"` + `display: "grid"` IS A SEAM FIX, NOT A LAYOUT OPINION —
         * ADDED 2026-09-21.
         *
         * `<CardPage>` is fluid, so its height is whatever the fixture's row count makes it,
         * and `.mk-phone-frame__screen` (`marketing-hero.css`) is a FIXED 9/19.5 window. Those
         * two numbers used to be 810 and 728 — the card overflowed, the screen clipped it, and
         * the clip was the intended reading ("there is more card"). The 2026-09-20 trim took
         * the card to ~724px, four pixels UNDER the window, and the difference showed as a
         * hairline of `--mk-white` between the card's warm ground and the bottom bezel: a seam
         * across the glass, which is exactly what a device must not have.
         *
         * A grid container with one child stretches its auto row to the container's height
         * (`align-content: stretch`, the initial value), and the child stretches with it. So
         * the card's own `<article>` — and therefore its own ground — reaches the bottom of the
         * screen whatever its content height is, with no assumption here about what colour that
         * ground is (a palette this file does not own) and no change to `<CardPage>`, which
         * this round still holds read-only. It is also the correct behaviour in BOTH
         * directions: a taller fixture overflows and clips exactly as before, because
         * `min-height` cannot shrink anything.
         */
        style={{ width: `${SCREEN_WIDTH}px`, minHeight: "100%", display: "grid" }}
      >
        <CardPage
          resolved={resolved}
          showCredit={false}
          actions={
            !canBuildVcf(resolved) ? undefined : (
              <div data-card-actions="" data-card-action-count={1}>
                <CardActionButton
                  action="save"
                  paletteId={resolved.palette.id}
                  palette={resolved.palette}
                  variant="primary"
                  surface="canvas"
                  shape={shape}
                  icon={<SmartphoneNfc size={18} strokeWidth={1.75} />}
                  trailing={<ArrowRight size={18} strokeWidth={1.75} />}
                >
                  Send to Phone
                </CardActionButton>
              </div>
            )
          }
        />
      </div>

      <figcaption className="sr-only">{CAPTION}</figcaption>
    </figure>
  );
}

/**
 * ⚠ `hero.tsx`'s call site changed WITH this file, not after it.
 *
 * This component used to take `face`/`frontLabel`/`backLabel`/`caption` and `hero.tsx` built the
 * first from a server-rendered `<ShareFace>`. The moment this file started resolving and
 * rendering its own card (above), that shape stopped compiling — Agent E reconciled `hero.tsx`
 * to `<HeroCard />` with no props in the same round, in parallel, and removed the imports that
 * call site existed for (`ShareFace`, its own `resolveCard` call, `FIXTURE_DB`, `heroCard`,
 * `marketingUser`, `liveCard`). `hero.cardHint`, `cardFrontLabel` and `cardBackLabel` stay in the
 * fixture, unrendered, for the reason `hero.tsx`'s own comment at that call site gives — they
 * described a press this card no longer offers.
 */
