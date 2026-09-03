"use client";

import { Download, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";

import { canBuildVcf } from "@/card/build-vcf";
import { CardActionButton } from "@/card/card-action-button";
import { CardPage } from "@/card/card-page";
import { hasWhatsAppAction } from "@/components/public-card/whatsapp-button";
import type { ResolvedCard } from "@/types/domain";

/**
 * The pinned live preview — **the card page, in a phone frame.**
 *
 * ## Why this stopped being the share face
 *
 * A card still renders as two objects, and the split did not change:
 *
 *   · the **share face** — rigid, wallet-shaped, 336×500, a name, at most two details and the
 *     QR. It is the *wallet pass*: the thing that goes into Apple/Google Wallet, gets exported
 *     to PNG and photographed off a desk. `<ShareFace>` owns it and `/cards/[cardId]` shows it.
 *   · the **card page** — a real page with no height, carrying every field the owner mapped,
 *     the Linktree shape: mark, avatar, name, bio, then a stack of tappable rows. `/c/{slug}`
 *     serves it.
 *
 * What changed is **which of the two is the product**. The page is. The face is a pass you put
 * in a wallet; the page is the card. So the builder must preview the page — an owner adding
 * their seventh field to a card whose preview shows at most two of them is being asked to edit
 * one object while looking at another, which is the same class of mistake as the old build's
 * "the previewed file differs from the sent file".
 *
 * The face is not previewed here any more, and nothing was lost by that: it is rendered
 * unscaled on `/cards/[cardId]`, which is where the whole QR contract suite measures it.
 *
 * ## ⚠ The frame scrolls. `CardPage` does not, and must never be made to.
 *
 * `<CardPage>` has **no height, no `max-height` and no `overflow`**, anywhere in that file, and
 * that absence is the fix for the defect that forced this rebuild: the previous build drew one
 * fixed canvas for every purpose, so a card with twenty-five fields had `overflow-y: auto` on
 * *itself* and silently clipped its own last row. Every screenshot of that build shows a
 * "5 fields" label above four visible rows.
 *
 * A preview pane is exactly where somebody would put that `overflow` back, because the pane is
 * short and the card is long. So it is put **here instead**, on `[data-preview-frame]`, which is
 * a *viewport onto* the card and not the card. The card inside it is at its natural full height
 * with every row drawn; the frame is what runs out of room, and it says so with a scrollbar the
 * way a phone screen does. Nothing in this file may set a height, a `max-height` or an
 * `overflow` on `<CardPage>` — the fix lives in that absence.
 *
 * ## Why there is no `scale()` any more, and why the measurement stayed
 *
 * The face had to be transform-scaled: it is rigid by construction (`flexShrink: 0`, a fixed
 * 336×500) because a wallet pass that disagrees with itself about its aspect ratio cannot stack,
 * export or print — and its QR clears the 140px scannable floor by *one pixel*, so reflowing it
 * to fit would have produced a card that no longer decodes. Zoom was the only tool left.
 *
 * The card page is `width: 100%`. It reflows, so a **phone-width column** is the whole of the
 * fit: at 336px it lays out exactly as it will on the phone the reader is holding, which is more
 * honest than a 400px card shrunk to 0.84. **The scale factor is therefore deleted**, along with
 * the scaled-size wrapper that existed to stop the layout reserving the unscaled height.
 *
 * The **measured height budget is kept, unchanged in kind**, and losing the scale is not a
 * reason to declare one. `lg:h-[500px]` was here first and put the card's last row 3px below the
 * fold on a 1280×720 desktop — AC-29 asks for the preview visible *without scrolling*, and three
 * pixels is exactly the sort of miss a declared height hides. The frame's top edge is still a
 * function of the shell's rail, the shell's padding, the split ratio and the header's height:
 * four numbers in four other files, any of which can move. See {@link useFitBudget}.
 *
 * ## The actions are look-alikes, and a preview of a button is not a button
 *
 * `<CardPage>`'s action slot takes the real controls on `/c/{slug}` — a Save that writes a
 * `.vcf` through a blob URL, a WhatsApp deep link. Neither belongs in an editor: Save would
 * download a file from a card that has not been saved, and the deep link would navigate the
 * owner out of the builder mid-edit. But omitting them would make the preview lie about the
 * page's layout, because those two buttons are ~100px of it.
 *
 * So {@link InertActions} draws them with the **same `<CardActionButton>` the live page uses** —
 * so the skin, the palette rule and the button shape cannot drift — with no `href` and no
 * `onClick`, inside a container marked `inert`. `inert` takes the whole subtree out of the
 * accessibility tree and out of the tab order, which is the part that matters: a screen-reader
 * user tabbing the builder must not meet a "Save to contacts" that does nothing, and an axe
 * sweep must not count a decorative link. `[data-card-actions-preview]` is what tells the two
 * apart from outside.
 */

export interface BuilderPreviewProps {
  /** ⚠ The one resolved card (I-5). Never re-resolved here. */
  resolved: ResolvedCard;
}

export function BuilderPreview({ resolved }: BuilderPreviewProps): ReactElement {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const budget = useFitBudget(stageRef, frameRef);

  return (
    <div
      ref={stageRef}
      data-builder-preview=""
      /* A definite height below `lg` so the device below can flex inside it: `max-height` alone
         gives a flex child nothing to distribute, and the frame would then measure its own
         content and never shrink. The height is INHERITED from the pinned pane rather than
         restated here — see the `className` note below and `--builder-preview-h` in
         `tokens.css` — so the caption is always inside the visible box rather than past it.

         ⚠ **The stage is bare now — no border, no ground, no padding — and the hairline that
         used to be here has not been deleted so much as MOVED onto the device below.** It was
         put here originally to cover a compositing artefact: the pinned pane is `position:
         sticky`, so Chrome promotes it to its own layer and paints a 1px seam along that
         layer's texture edge at devicePixelRatio 2. The seam lands on whatever box coincides
         with the pane, and the device shell now does — it is a real, opaque, shadowed edge on
         exactly that rectangle, which covers the artefact far better than a hairline did. */
      /* ⚠ `h-full`, and it must never go back to a declared `svh` again.
         The pane above this is `--builder-preview-h` tall and clips; this stage used to say
         `h-[58svh]` while that pane said `max-h-[50svh]`, and the 8svh difference was silently
         cut off — 65px on a 375x812 phone, which is the bottom of the card frame plus the whole
         caption. `h-full` makes the stage exactly the pane, so the flex column below can only
         distribute space that actually exists and nothing can be lost. `tokens.css` carries the
         number and the full account of the bug. */
      className="flex h-full flex-col items-center gap-3 lg:h-auto"
    >
      {/* ── the device ───────────────────────────────────────────────────────────
          ⚠ **The black bezel is gone.** It was an opaque `--ink` shell with 8px of padding and
          a 30px radius around a 22px screen — a drawn phone. Three things were wrong with it:

          · **It is a costume, not information.** The card is a web page. Wrapping it in a
            device tells the owner nothing they do not know and spends 16px of the pane's width
            plus a hard black rectangle that out-contrasts the card inside it — on a deep card
            the bezel and the ground merged, and on a light one the bezel was the loudest thing
            on the screen.
          · **It fought the app's own register.** Every other surface in this build is white
            chrome with a hairline. One opaque black object in the middle of it reads as a
            component from a different product.
          · **It made the card wide and short.** 352px of shell is 336px of screen. 320px is
            the narrowest common handset viewport (iPhone SE 1st gen), so it is a real column
            rather than an invented one — and at 300 an ordinary two-word name started wrapping,
            which is a preview inventing a problem the recipient will not have.

          What the shell was *load-bearing* for is kept: it covered a compositing artefact —
          the pinned pane is `position: sticky`, so Chrome promotes it and paints a 1px seam
          along that layer's texture edge at dPR 2. The frame below now carries a real border
          and shadow on exactly that rectangle, which covers it for the same reason the shell
          did, without being a phone.

          This element survives as a plain layout box: it owns the width cap and the flex
          behaviour, so the frame below is free to be nothing but the screen. */}
      <div
        data-preview-device=""
        className="flex min-h-0 w-full max-w-[320px] flex-1 flex-col lg:flex-none"
      >
        <div
          ref={frameRef}
          data-preview-frame=""
          /* ⚠ **The one scroll container in this preview, and it is not the card.** See the
             module note: `<CardPage>` has no height and no overflow by design, so the thing
             that runs out of room has to be the frame around it. `overflow-y-auto` is the phone
             screen; `-x` is hidden because a 60-character unbroken token (§11 E-15) must never
             produce a sideways scrollbar in an editor pane.

             ⚠ **`flex flex-col`, and the card inside it is `flex-1`. That pairing is the other
             half of the background fix** (`card-page.tsx` holds the first). The frame has a
             definite height and the card did not, so a card with no fields drew a short article
             on a tall white screen and the ground — which is `inset: 0` of the article — stopped
             where the article did. As a flex child the card is handed the whole screen when it
             does not need it, and `flex-grow` cannot shrink it below its content when it does,
             so a twenty-five-field card still lays out full height and scrolls here.

             Below `lg` the frame is a flex child of a fixed-height ancestor, so flexbox hands it
             a definite height and nothing here has to say what it is. At `lg` and above the
             stage has no height, so it takes the measured budget in pixels — see `useFitBudget`
             for why that is measured rather than declared. */
          style={budget === null ? undefined : { height: `${budget}px` }}
          className={
            "flex min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden " +
            "rounded-[26px] border border-line bg-canvas shadow-[var(--elevation-2)] " +
            "lg:flex-none"
          }
        >
          {/* No `className` carrying a height, a `max-height` or an `overflow`. Ever.
              `flex-1` is none of those three — it is what lets the card TAKE the screen it is
              given, and it is why the ground no longer depends on the field count. */}
          <CardPage
            resolved={resolved}
            actions={<InertActions resolved={resolved} />}
            className="flex-1"
          />
        </div>
      </div>

      <p
        data-builder-preview-summary=""
        className="w-full shrink-0 truncate text-center text-xs text-ink-4"
      >
        {`${resolved.cardName} · ${resolved.palette.name}`}
      </p>
    </div>
  );
}

/**
 * The page's two actions, drawn and dead.
 *
 * Same component, same palette rule, same button shape as the live page — `<CardActionButton>`
 * is imported rather than reimplemented, so a redesign of the real control redesigns this one
 * and the preview cannot come to disagree with the page about how tall its own action row is.
 *
 * What is deliberately **not** copied is the behaviour:
 *
 *   · **no `href`.** `<CardActionButton>` renders an `<a>` when given one, and a live `wa.me`
 *     link inside the builder is an outbound navigation one mis-click away from losing an
 *     unsaved edit. Without it the component renders a `<button>` — same box, same paint.
 *   · **no `onClick`.** Not a no-op handler: nothing to call at all, so there is no code path
 *     from this subtree into `buildVcf`.
 *   · **`inert` on the container**, which is the load-bearing one. It removes the whole subtree
 *     from the tab order *and* from the accessibility tree, so a keyboard user never lands on a
 *     button that does nothing and a screen reader never announces one. Marking the buttons
 *     `disabled` instead would have kept them in the tree, announced as "dimmed" — a false
 *     statement about a card whose real Save works perfectly.
 *
 * The two conditions are the live page's own, from the live page's own definitions:
 * `canBuildVcf` (T11's single definition of "this card shares something", the same one the E-01
 * guard reads) and `hasWhatsAppAction` (§11 E-56 — no mapped `PHONE`, no action; absent, never
 * greyed out). A local field count here would let the preview show a button the real page will
 * not render, which is precisely the drift this slot exists to prevent.
 */
function InertActions({ resolved }: { resolved: ResolvedCard }): ReactElement {
  const shape = resolved.template.shape.buttonShape;
  /* `solid` runs the palette the full height of the page, so the actions stand ON the palette;
     `band` and `quiet` hand the body to the app canvas, so they need the canvas colourway or
     Cobalt's white primary fill lands on white. The live page decides it exactly this way. */
  const surface = resolved.template.pageHeader === "solid" ? "palette" : "canvas";
  const saveable = canBuildVcf(resolved);
  const messageable = hasWhatsAppAction(resolved);
  const count = (saveable ? 1 : 0) + (messageable ? 1 : 0);

  return (
    <div
      data-card-actions=""
      /* What separates this row from the real one in any locator. The live page's row is on
         `/c/{slug}` and on nothing else; this is the only `[data-card-actions]` inside
         `[data-builder-preview]`, and it says so rather than leaving a reader to infer it. */
      data-card-actions-preview=""
      data-card-action-count={count}
      inert
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
    >
      {!saveable ? null : (
        <CardActionButton
          action="save"
          paletteId={resolved.palette.id}
          palette={resolved.palette}
          variant="primary"
          surface={surface}
          shape={shape}
          icon={<Download size={16} strokeWidth={1.75} />}
        >
          Save to contacts
        </CardActionButton>
      )}

      {!messageable ? null : (
        <CardActionButton
          action="whatsapp"
          paletteId={resolved.palette.id}
          palette={resolved.palette}
          variant="secondary"
          surface={surface}
          shape={shape}
          icon={<MessageCircle size={16} strokeWidth={1.75} />}
        >
          Message on WhatsApp
        </CardActionButton>
      )}
    </div>
  );
}

/**
 * How tall the preview frame may be.
 *
 * ## Why this is measured and not declared
 *
 * `lg:h-[500px]` was here first, and it was wrong for the reason this module's own note warns
 * about: on a 1280×720 desktop the header leaves 527px above the fold, so a 500px frame plus the
 * variant switch and the caption ran 21px past it and the card's last row ended 3px below the
 * viewport. AC-29 asks for the preview visible **without scrolling**, and three pixels is exactly
 * the kind of miss a declared height hides.
 *
 * ⚠ **Neither losing the variant switch nor losing the scale factor makes a declared height safe
 * again.** The switch moved the frame's top edge up by ~40px and nothing else; dropping the scale
 * changed what is *inside* the frame and nothing about where the frame is. The four numbers below
 * still live in four other files, and the next change to any of them would put the fold back
 * through the card. The measurement is what makes that unfailable, so it is kept exactly as it
 * was — only its second return value, the scale, is gone.
 *
 * The frame's own position is a function of the shell's rail, the shell's padding, the split
 * ratio and the header's height. Four numbers in four other files. So the budget is taken from
 * where the frame actually is:
 *
 *   · **below `lg`** the frame is a flex child of a root whose height comes from the pinned
 *     pane (`--builder-preview-h`), so flexbox has
 *     already computed a definite height for it and the CSS is the budget — this hook returns
 *     `null` and writes no inline height at all;
 *   · **at `lg` and above** the root has no height, so the budget is what is left of the
 *     viewport beneath the frame's top edge, less everything of the stage that sits *below* the
 *     frame — the gap, the caption, the bottom padding and the bottom hairline. That reserve is
 *     measured too (`stage.bottom - frame.bottom`) rather than written down: see
 *     {@link CAPTION_RESERVE_FALLBACK} for the pixel the written-down version got wrong.
 *
 * ## Why this does not chase its own tail
 *
 * On desktop the height is written back to the same element that was measured, which sounds
 * circular and is not: the frame's `top` is determined entirely by the header *above* it, so
 * changing its height cannot move it. The second pass measures the same `top`, computes the
 * same budget, and settles.
 *
 * `ResizeObserver` deliberately does not fire on scroll, which matters here — the pinned pane is
 * `sticky`, so a scroll-driven re-measure would read a different `top`, hand back a different
 * budget and make the frame breathe as the control column scrolls. It also means the frame's own
 * *scrolling* — which is new, and which the card inside it does a lot of — cannot feed back into
 * its height.
 */

/**
 * What sits below the frame inside the stage — the gap, the caption and the stage's bottom
 * padding and hairline — **when the stage cannot be measured.**
 *
 * It is a fallback and nothing else. The real reserve is read off the two boxes at runtime
 * (`stage.bottom - frame.bottom`), because writing it down is how it goes wrong: the arithmetic
 * is `gap-3` + a 16px line + `lg:p-4` + a 1px border, four values in one Tailwind string, and
 * the version of this constant that said `44` was one pixel short of all four of them. That one
 * pixel put the bottom of the stage at y=901 on a 900px viewport.
 *
 * Measuring the difference is not circular: changing the frame's height moves the stage's bottom
 * and the frame's bottom by the same amount, so the difference is invariant and the second pass
 * computes the same number as the first.
 */
const CAPTION_RESERVE_FALLBACK = 46;

/** Tailwind's `lg`. The one breakpoint value this file has to know, because the two branches
 *  above are genuinely different mechanisms rather than two sizes of the same one. */
const LG = 1024;

/* There is deliberately **no minimum** on the budget. A floor would be the declared height
   sneaking back in through the side door: on a short desktop viewport it would make the frame
   taller than the space beneath it, push the caption under the fold and fail the very assertion
   this measurement exists to satisfy. A short viewport gets a short frame that scrolls more,
   which is the honest outcome. */

function useFitBudget(
  stageRef: React.RefObject<HTMLDivElement | null>,
  frameRef: React.RefObject<HTMLDivElement | null>,
): number | null {
  /** `null` until measured, and on every mobile pass — so the CSS owns the height there. */
  const [budget, setBudget] = useState<number | null>(null);

  const measure = useCallback(() => {
    const node = frameRef.current;
    if (node === null) return;

    if (window.innerWidth < LG) {
      setBudget(null);
      return;
    }

    const frame = node.getBoundingClientRect();
    const stage = stageRef.current?.getBoundingClientRect();
    /* Everything of the stage that is below the frame. Negative is impossible in the intended
       layout and would mean the stage had been clipped, in which case the fallback is the safer
       of the two answers. */
    const reserve =
      stage === undefined || stage.bottom < frame.bottom
        ? CAPTION_RESERVE_FALLBACK
        : Math.ceil(stage.bottom - frame.bottom);

    const available = Math.floor(window.innerHeight - frame.top - reserve);

    // A frame that has not been laid out yet measures 0 or negative; keeping the last good
    // value avoids a frame of height 0, which renders an invisible card.
    if (available <= 0) return;

    setBudget(available);
  }, [frameRef, stageRef]);

  useEffect(() => {
    const node = frameRef.current;
    if (node === null) return;

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    /* ⚠ The **stage** is observed too, and it is not redundant. The frame's own height is what
       this hook writes, so once it is set the frame stops changing size and its observation
       goes quiet — while the caption underneath it can still reflow (a long card name wraps to
       two lines), which changes the reserve and therefore the budget. Observing only the frame
       left that case measuring a stale reserve until the next window resize. */
    const stage = stageRef.current;
    if (stage !== null) observer.observe(stage);
    /* The viewport's height is half the desktop budget and no element reports it, so the
       window is observed too. */
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, frameRef, stageRef]);

  return budget;
}
