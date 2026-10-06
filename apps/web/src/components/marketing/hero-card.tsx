import type { ReactElement } from "react";

import { heroPhone } from "@/fixtures/marketing";

import { BrandCard } from "./brand-card";
import { PhoneFrame } from "./phone-frame";

/**
 * THE HERO'S CARD — the client's reference card, drawn still, in the reference's phone.
 *
 * ## 2026-10-06 — THE DRAWING NOW LIVES IN `brand-card.tsx`
 * The client asked for the Solution deck's and the How-it-works panels' cards to be this card,
 * so the drawing moved into `<BrandCard>` and all three draw it. This file passes the measured
 * layout and the reference's content; the markup, classes and pixels are what they were (a 2×
 * screenshot diff of the phone before and after the move is zero). Two client changes landed on
 * the same day and are the only visible differences from 2026-09-29: the handwritten "Privacy /
 * Relationships / Ideas" overlay is gone (it was live type over a clean portrait, so nothing was
 * cropped or masked), and the badge carries the brand mark rather than a traced "CB" monogram
 * (`hero-medallion.tsx`). Its type is in `hero-fonts.ts`.
 *
 * ## ⚠ 2026-09-29 — NO LONGER THE PRODUCT'S `<CardPage>`, AND NO LONGER MOVING
 *
 * From 2026-09-20 this file rendered the real `<CardPage>`, and from 2026-09-28 it re-resolved
 * that card once per city so it could animate — a cross-fade between cards, with changed lines
 * tinted and tagged "Updated". The client rejected the result as "just the opposite" of their
 * reference: a component built to lay out any card cannot also be one specific, crafted
 * composition, and the automatic highlighting was never asked for. So this is now a bespoke,
 * still drawing of the reference card, with every size, gap, ink and glyph read off the
 * reference render (the measured specs are summarised in `marketing-hero.css`).
 *
 * What that costs, said plainly: this card no longer proves anything about `<CardPage>`. It is
 * a picture of a card — which is also all the reference is.
 *
 * ## Layout
 * The card is laid out at a FIXED 330px design width (the reference's screen, 326px, ×1.012)
 * and fills the screen exactly: the reference ends on its social row with 24px of sheet below
 * it, so nothing is clipped. The device's rendered size comes only from `--mk-phone-zoom`
 * (`hero.tsx`), so this layout is never reflowed — it is re-rasterised at the target size.
 *
 * ## Why `inert`, and the caption
 * It draws a button and tappable rows that do nothing. `inert` removes the whole subtree from
 * the tab order and the accessibility tree (`aria-hidden` over focusable content would be a
 * WCAG failure of its own), and the `<figcaption>` describes the card in its place.
 */
export function HeroCard(): ReactElement {
  const c = heroPhone;
  return (
    <PhoneFrame>
      <BrandCard
        layout="measured"
        cover={{ kind: "photo", x2: c.portrait.x2, x3: c.portrait.x3, priority: true }}
        brand={c.brand}
        name={c.name}
        role={c.role}
        company={c.company}
        bio={c.bio}
        action={c.action}
        sections={c.sections}
        social={{ label: c.socialLabel, platforms: c.social }}
        caption={c.caption}
        cardAttributes={{ "data-hero-card": "" }}
      />
    </PhoneFrame>
  );
}
