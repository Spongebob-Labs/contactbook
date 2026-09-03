"use client";

import { Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { FACE_WIDTH } from "@/card/share-face";
import { useToast } from "@/components/overlay";
import { Button } from "@/components/primitives/button";
import type { ResolvedCard } from "@/types/domain";

/**
 * **The wallet-pass block on `/cards/[cardId]` — the surface that finally says what the
 * `<ShareFace>` is for.**
 *
 * ## The defect this component exists to fix
 *
 * Contact Book has two verticals and the product only ever expressed one of them. The
 * *card* — the tappable page at `/c/{slug}` — is obvious the moment you open it. The
 * **pass** was not: `card-detail-client.tsx` painted a rigid 336×500 `<ShareFace>` with a QR
 * on it, captioned nothing, offered no way to carry it, and left a reasonable person to
 * conclude they were looking at a second, smaller drawing of the same card. Every sentence
 * that would have explained it lived in a doc comment. `share-face.tsx` already states the
 * intent outright — *"These are wallet passes: they are added to Apple Wallet"* — and
 * `template-types.ts` repeats it. Neither string was ever on screen.
 *
 * So this block does three things and deliberately nothing else:
 *
 * 1. **It captions the face**, above it, before you reach it — "Wallet pass", then one
 *    sentence describing the physical act (bring it up, someone scans it). A label that
 *    arrives *after* the object it names has already failed the person who scrolled past.
 * 2. **It states what the QR encodes**, in words, with the payload printed. That sentence is
 *    the entire point of the vertical: the QR is an *accessibility shortcut to the link*, not
 *    a separate artefact. Somebody who thinks the QR carries their contact details will
 *    reason about the whole product wrongly — including about what deleting the card breaks.
 * 3. **It offers the two wallet controls**, and tells the truth about them (see below).
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
 *   only ancestors of the plate. The controls therefore sit strictly **beneath** the face in
 *   normal flow, and nothing in this file is positioned. An "Add to Wallet" chip floated over
 *   the card's corner would have been the obvious visual design and would have failed all
 *   three tiers, correctly.
 * · **The block is exactly one face wide.** `width: FACE_WIDTH` is read from the face's own
 *   module rather than typed as a literal. The previous code pinned the in-card Save button
 *   to `w-[360px]` with a comment claiming that was "the face's own width"; the face is 336,
 *   so the button overhung it by 24px. One imported constant is why that cannot drift again.
 *
 * ## ⚠ THE CONTROLS ARE HONEST BEFORE THEY ARE PRESSED, NOT AFTER
 *
 * §3.1 is a hard wall: the fixture gateway is the only data source and the built app makes
 * **zero** outbound requests. A real "Add to Apple Wallet" needs a `.pkpass` signed by a
 * server this build does not have, so there is nothing to install and this run does not
 * pretend otherwise. Two rules follow:
 *
 * · **No fake artefact.** No `.pkpass` blob, no `<a download>`, no external URL, no new
 *   dependency. A download that produces a file no wallet will accept is worse than no
 *   download — it fails silently, on the user's phone, later.
 * · **{@link WALLET_UNAVAILABLE_NOTE} is printed under the buttons, not only in the toast.**
 *   A control that looks live and only admits it is inert once you have pressed it is the
 *   small dishonesty this codebase keeps refusing elsewhere (§8D.7's "a control that exists
 *   only to refuse is a worse answer than no control"; the empty card's *absent* rather than
 *   disabled Save). The buttons must exist — the whole job here is to make the vertical
 *   legible — so the status is stated up front and the toast adds the *reason* and the thing
 *   that does work today. The two strings deliberately do not repeat each other.
 *
 * The buttons are not `aria-disabled` either, and that is not an oversight: a disabled
 * `Button` swallows its own click (see `primitives/button.tsx`), so the explanation would
 * never be reachable by the person who wanted it.
 *
 * ## ⚠ EVERY CONTROL IN THIS BLOCK IS AN APP CONTROL. NONE OF THEM MAY BE A CARD BUTTON.
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
 * So the rule for this block is positional rather than per-palette, because a per-palette fix
 * would have to be re-derived every time a ground is added: **on the app canvas, controls wear
 * the app's chrome.** `tokens.css` exists to disappear so that a card is the only coloured
 * thing on screen, and the two wallet buttons below were already plain `<Button>`s — the save
 * action was the only control in the block dressed as the card. The palette buttons stay where
 * they belong: inside `<CardPage>`'s action slot, on the palette's own ground, where a
 * palette-coloured button is the correct answer and the public page uses it.
 *
 * ## Why the block renders for a card that shares nothing
 *
 * `canBuildVcf` gates the `.vcf` and every control that would write one — it does **not**
 * gate this block. A zero-field card still has a slug, still has a resolvable link and still
 * carries a decodable QR (`qr-scannability.spec.ts` asserts exactly that for
 * `card_empty_demo`). The pass is a pointer to the card; it does not stop being a pointer
 * because the card is currently thin. Gating it on `canBuildVcf` would have introduced a
 * second, wrong meaning for "empty" on the one screen whose module note exists to keep that
 * word to a single definition.
 */

/** The eyebrow that names the object. Short on purpose — the sentence below carries it. */
export const WALLET_PASS_OVERLINE = "Wallet pass";

/**
 * What the face *is*, in the physical terms a person actually experiences it in.
 *
 * Written as an action rather than a description ("bring it up… let them scan it") because
 * the failure being fixed is that nobody knew the object had a use, not that nobody knew what
 * it was called.
 */
export const WALLET_PASS_LEDE =
  "This is the pass you hand over. Add it to your phone's wallet, bring it up when you meet " +
  "someone, and let them scan it.";

/**
 * The QR's job, said once, in one line.
 *
 * The payload is printed rather than merely linked. The screen's metadata block already
 * offers `/c/{slug}` as a working link one column over; a second anchor to the same place
 * would compete with it for the reader's attention while adding no destination. What is
 * missing from the screen is not a route to the URL — it is the *fact* that the symbol
 * resolves to that URL and to nothing else.
 */
export function walletQrNote(qrPayload: string | null): string {
  if (qrPayload == null) {
    return "This card has no QR yet — save it and one is generated automatically.";
  }
  // ⚠ Deliberately no longer "the same link Share sends". Share sends a per-recipient link
  // minted for one contact; this is the card's own public URL, which is what a QR — printed,
  // on a lock screen, shown to strangers — has to be. Saying they are the same was true only
  // while the QR was hijacking whichever ShareLink had most recently been minted.
  return `Scanning the QR opens ${qrPayload} — this card's own public link.`;
}

/** Stated under the controls, before anyone presses one. See the module note. */
export const WALLET_UNAVAILABLE_NOTE = "Neither button installs anything yet.";

/** The toast title: the state of the world, with no apology and no error dressing. */
export const WALLET_UNAVAILABLE_TITLE = "Wallet delivery isn't connected yet";

/** The toast body: the reason, then the thing that does work today. */
export const WALLET_UNAVAILABLE_DETAIL =
  "A pass has to be signed by a server, and this build has none. Share sends the same link " +
  "in the meantime.";

/** The two wallets, in the order the labels are read. `id` is the test hook. */
const WALLETS = [
  { id: "apple", label: "Add to Apple Wallet" },
  { id: "google", label: "Add to Google Wallet" },
] as const;

export interface WalletPassBlockProps {
  /** The one `ResolvedCard` the face, the `.vcf` and the PNG all share (I-5). */
  resolved: ResolvedCard;
  /**
   * ⚠ **The `<ShareFace>` AND NOTHING ELSE.**
   *
   * Taken as `children` rather than rendered here so this component never becomes a second
   * place that decides how the face is mounted — see the module note on the five QR suites.
   *
   * It used to also carry the owner's save button, and that was a bug: `children` is rendered
   * inside {@link WalletPassBlockProps.action}'s sibling rail, which is `overflow-x-auto`, so
   * the button was **inside the horizontal scroller** with the rigid card. On a 320px screen
   * the rail's client width is 296 while the face is 336, so a `w-full` button came out 40px
   * narrower than the card *and* needed a sideways scroll to reach its own right edge. Pass
   * the action through `action`; this slot is the card.
   */
  children: ReactNode;
  /**
   * The owner's primary action for this card, drawn directly under the face and **outside the
   * scroll rail**.
   *
   * ⚠ It must be an APP control — `components/primitives/button` — and never a
   * `<CardActionButton>`. See the ⚠ block in the module note: a palette-coloured button here
   * is the same colour as the card for every deep palette, and reads as part of it.
   */
  action?: ReactNode;
}

export function WalletPassBlock({ resolved, children, action }: WalletPassBlockProps) {
  const { toast } = useToast();

  return (
    <div
      data-wallet-pass=""
      className="flex flex-col gap-4"
      /* One face wide, from the face's own constant — never a literal, never wider than the
         column at 360 (the shell's `px-3` leaves exactly `FACE_WIDTH`). */
      style={{ width: `${FACE_WIDTH}px`, maxWidth: "100%" }}
    >
      {/* Above the face, not below it: the label has to arrive before the object it names. */}
      <div data-wallet-pass-caption="" className="flex flex-col gap-1">
        <h2 className="text-overline uppercase text-ink-3">{WALLET_PASS_OVERLINE}</h2>
        <p className="text-base text-ink">{WALLET_PASS_LEDE}</p>
      </div>

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
       * column it took the caption and the QR note with it, so the wallet-pass *prose* was
       * 336px wide in a 296px box and had to be nudged sideways to be read — a worse defect
       * than the one being fixed. Around the face alone, the text and the buttons stay fluid
       * and only the rigid object overhangs.
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

      {/* ⚠ OUTSIDE THE RAIL, DELIBERATELY. Inside it, this button joined the card in a
          horizontal scroller and was sized by the rail's client width rather than the block's
          — see the ⚠ on `children`. Out here it is fluid, like every other control in the
          block, and it still sits directly under the face where the owner looks for it. */}
      {action == null ? null : <div data-wallet-pass-action="">{action}</div>}

      <div data-wallet-pass-actions="" className="flex flex-col gap-3">
        {/* `break-all`: the payload is a URL and this column is 336px at every viewport, so a
            long slug would otherwise push the whole page sideways (E-15, E-53). */}
        <p data-wallet-qr-note="" className="text-sm break-all text-ink-3">
          {walletQrNote(resolved.qrPayload)}
        </p>

        {/* `flex-wrap`, so the pair stacks rather than overflowing: both labels are
            `whitespace-nowrap` and together they are wider than 336 at every viewport. */}
        <div className="flex flex-wrap gap-2">
          {WALLETS.map((wallet) => (
            <Button
              key={wallet.id}
              variant="secondary"
              data-wallet-add={wallet.id}
              onClick={() => {
                /* No download, no request, no dependency (§3.1). The press is answered with
                   a sentence, which is the only true thing this build can do here. */
                toast({
                  title: WALLET_UNAVAILABLE_TITLE,
                  description: WALLET_UNAVAILABLE_DETAIL,
                });
              }}
            >
              <Wallet aria-hidden="true" className="size-4" />
              {wallet.label}
            </Button>
          ))}
        </div>

        <p data-wallet-pass-status="" className="text-xs text-ink-3">
          {WALLET_UNAVAILABLE_NOTE}
        </p>
      </div>
    </div>
  );
}
