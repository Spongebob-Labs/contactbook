import type { ReactNode } from "react";

import { FACE_WIDTH } from "@/card/share-face";

/**
 * **The wallet-pass block on `/cards/[cardId]` — the frame the share face is presented in.**
 *
 * It names the object and gives it a rail to sit in. That is the whole component, and the
 * shortness is the design: this is the OWNER's screen, and the owner already knows what their
 * own card is.
 *
 * ## ⚠ WHAT THIS BLOCK USED TO CARRY, AND WHY IT IS NOT COMING BACK
 *
 * Client review, 2026-09-20, looking at this page: *"this page is looking very cluttered.
 * There is too much information in this, and there is random text in this… this looks very
 * unprofessional."* Four things were removed, and each had a rationale that did not survive
 * contact with the person who owns the card:
 *
 * · **"Add to Apple Wallet" / "Add to Google Wallet".** §3.1 means this build cannot sign a
 *   `.pkpass`, so both controls did nothing but raise a toast explaining that they do nothing,
 *   under a line of body copy (`WALLET_UNAVAILABLE_NOTE` — *"Neither button installs anything
 *   yet."*) that said so before they were pressed. Being honest about an inert control is
 *   better than lying about it; **not shipping the inert control is better than either.** The
 *   client was explicit: *"I don't want this thing to be visible in any of the places."* When
 *   wallet delivery is real, the button arrives with it — not before it.
 * · **The lede** (*"This is the pass you hand over. Add it to your phone's wallet…"*). It was
 *   written to teach the vertical to somebody meeting it for the first time. The owner built
 *   this card; the tutorial reads as filler on their own detail screen.
 * · **The QR note** (*"Scanning the QR opens {url}…"*). The URL is already on this screen once,
 *   as a real link, in the metadata block beside the card. Printing it a second time in prose
 *   was the "random text" in the report.
 * · **"Save to contacts"** — see the ⚠ in `card-detail-client.tsx`. Saving your own card into
 *   your own address book is not an action anyone takes.
 *
 * What survived is the eyebrow, because the face still needs a name: the product has two
 * verticals — the *pass* you hold up to be scanned, and the *card* the link opens — and
 * without a label a 336×500 object with a QR on it reads as an unexplained second drawing of
 * the same card. Two words above it is enough, and it sits in the same
 * `text-overline`/`uppercase` rhythm as "Fields" and "Sent to" in the column beside it, so the
 * screen reads as one page rather than a card with a caption bolted on.
 *
 * ## ⚠ WHY THIS COMPONENT WRAPS THE FACE INSTEAD OF SITTING BESIDE IT
 *
 * Five contract suites — `qr-geometry`, `qr-plate`, `qr-overlap`, `qr-occlusion`,
 * `qr-scannability` — decode and measure the share face **on this exact route**, because it
 * is the only surface that paints it at its unscaled 336×500 design size (see
 * `tests/helpers/qr-surface.ts`). Three consequences follow, and all three shaped this file:
 *
 * · **The face is passed in as `children` and rendered verbatim.** This component never
 *   scales it, never clips it, never mounts it behind a tab or a dialog, and adds no
 *   `transform`, `overflow` or `contain` anywhere in its own tree. The wrapper is a plain
 *   static flex column. Every geometry constant in `qr-geometry.ts` was derived at
 *   `FACE_WIDTH`, so anything this wrapper did to the box would be measured as a product
 *   defect by QR-T1 rather than as a layout choice.
 * · **Nothing here may overlap the plate.** `qr-overlap.spec.ts` sweeps three independent
 *   ways — paint order inside the card root, an 11×11 `elementFromPoint` grid over the
 *   plate, and a pixel sweep of the rasterised plate — and its `fixedOverlays` pass reports
 *   *any* `fixed`/`sticky` box in the document that covers the reserved region, excluding
 *   only ancestors of the plate. Nothing in this file is positioned, and anything added later
 *   belongs strictly **above or beneath** the face in normal flow. An "Add to Wallet" chip
 *   floated over the card's corner would have been the obvious visual design and would have
 *   failed all three tiers, correctly.
 * · **The block is exactly one face wide.** `width: FACE_WIDTH` is read from the face's own
 *   module rather than typed as a literal. An earlier version pinned an in-card button to
 *   `w-[360px]` with a comment claiming that was "the face's own width"; the face is 336, so
 *   the button overhung it by 24px. One imported constant is why that cannot drift again.
 *
 * ## ⚠ EVERY CONTROL ADDED HERE LATER IS AN APP CONTROL. NONE MAY BE A CARD BUTTON.
 *
 * The owner's "Save to contacts" shipped as `<CardActionButton surface="canvas">`, and it
 * rendered as **a Sapphire rectangle one card wide, sixteen pixels under a Sapphire card, on
 * the white canvas.** The two blocks read as a single card with a slice cut out of it — the
 * client's report was *"what is this glitch onto the UI"*, and the card's own boundary was the
 * thing that had become unreadable, on the one screen whose entire job is to make the pass
 * legible as an object.
 *
 * ⚠ It is worth being precise about why no existing test caught it, because the gap is
 * instructive. `surface="canvas"` is a *legibility* mechanism and it worked exactly as
 * designed: `derive-palette.ts` sets `canvasActionBg` to "the palette's own ground … what
 * every deep palette uses", and `PALETTE_CONTRACT` proves that fill clears 3:1 **against the
 * app canvas**. Nothing ever asked whether it was distinguishable from the CARD DIRECTLY
 * ABOVE IT — and for all five deep palettes it is not merely similar, it is the same hex.
 * A button can be perfectly legible and still be the wrong object.
 *
 * So the rule is positional rather than per-palette, because a per-palette fix would have to
 * be re-derived every time a ground is added: **on the app canvas, controls wear the app's
 * chrome.** `tokens.css` exists to disappear so that a card is the only coloured thing on
 * screen. The palette buttons stay where they belong: inside `<CardPage>`'s action slot, on
 * the palette's own ground, where a palette-coloured button is the correct answer and the
 * public page uses it. `tests/contract/card-buttons-on-canvas.test.tsx` holds the line.
 *
 * ## Why the block renders for a card that shares nothing
 *
 * `canBuildVcf` gates the `.vcf` — it does **not** gate this block. A zero-field card still
 * has a slug, still has a resolvable link and still carries a decodable QR
 * (`qr-scannability.spec.ts` asserts exactly that for `card_empty_demo`). The pass is a
 * pointer to the card; it does not stop being a pointer because the card is currently thin.
 * Gating it on `canBuildVcf` would have introduced a second, wrong meaning for "empty" on the
 * one screen whose module note exists to keep that word to a single definition.
 */

/** The eyebrow that names the object, and the only copy left in the block. */
export const WALLET_PASS_OVERLINE = "Wallet pass";

export interface WalletPassBlockProps {
  /**
   * ⚠ **The `<ShareFace>` AND NOTHING ELSE.**
   *
   * Taken as `children` rather than rendered here so this component never becomes a second
   * place that decides how the face is mounted — see the module note on the five QR suites.
   *
   * It is also the reason a control must never be passed through this slot: `children` is
   * rendered inside the `overflow-x-auto` rail below, so a button placed here would join the
   * rigid card **inside the horizontal scroller**. On a 320px screen the rail's client width
   * is 296 while the face is 336, so a `w-full` button came out 40px narrower than the card
   * *and* needed a sideways scroll to reach its own right edge. This slot is the card.
   */
  children: ReactNode;
}

export function WalletPassBlock({ children }: WalletPassBlockProps) {
  return (
    <div
      data-wallet-pass=""
      className="flex flex-col gap-4"
      /* One face wide, from the face's own constant — never a literal, never wider than the
         column at 360 (the shell's `px-3` leaves exactly `FACE_WIDTH`). */
      style={{ width: `${FACE_WIDTH}px`, maxWidth: "100%" }}
    >
      {/* Above the face, not below it: a label has to arrive before the object it names. */}
      <h2 data-wallet-pass-caption="" className="text-overline uppercase text-ink-3">
        {WALLET_PASS_OVERLINE}
      </h2>

      {/**
       * ⚠ **The face's own rail — the one horizontal scroller on this screen, and it wraps the
       * card and nothing else.**
       *
       * `<ShareFace mode="full">` is rigid at `FACE_WIDTH` = 336px and cannot be narrowed: its
       * QR symbol clears the 140px scannable floor by a single pixel, so reflowing or scaling
       * it yields a card that no longer decodes. The shell's `px-3` leaves `viewport - 24`:
       *
       *   · **360px → 336px.** Exact fit, zero slack — the arithmetic `app-shell.tsx` documents.
       *   · **320px → 296px.** 40px short. Nothing clips between here and the document, so that
       *     overflow reached the page and **the whole screen scrolled sideways** on an iPhone
       *     SE, a Galaxy Fold cover screen, or any Android in split-screen (E-15 / E-53, P0).
       *
       * The rail is here rather than around the whole block on purpose. Wrapped around the
       * column it took the eyebrow with it, so the block's *text* was 336px wide in a 296px
       * box and had to be nudged sideways to be read — a worse defect than the one being
       * fixed. Around the face alone, anything else in the column stays fluid and only the
       * rigid object overhangs.
       *
       * `-mx-*` is deliberately absent: the rail sits inside the block's own edges so the card
       * scrolls within the column it belongs to rather than bleeding to the viewport.
       */}
      <div
        data-wallet-pass-rail=""
        className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain"
      >
        {children}
      </div>
    </div>
  );
}
