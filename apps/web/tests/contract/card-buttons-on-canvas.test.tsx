import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { TEMPLATE_PALETTES, PALETTE_ORDER } from "@/card/template-palettes";
import { WalletPassBlock } from "@/components/share/wallet-pass-block";

import { renderWithProviders } from "../helpers/render";

/**
 * **A card-coloured button may not stand on the app canvas.**
 *
 * ## The defect this exists to prevent, and why nothing else caught it
 *
 * `/cards/[cardId]` shipped the owner's "Save to contacts" as
 * `<CardActionButton surface="canvas">`. On a Sapphire card that rendered a **Sapphire
 * rectangle, one card wide, sixteen pixels below a Sapphire card**, on the white canvas. The
 * two blocks fused; the card's own bottom edge stopped being readable, on the one screen whose
 * whole job is to make the pass legible as an object. Reported as *"what is this glitch onto
 * the UI"*.
 *
 * ⚠ **It was not a contrast bug, and that is the instructive part.** `surface="canvas"` is a
 * legibility mechanism and it worked exactly as designed: `derive-palette.ts` sets
 * `canvasActionBg` to the palette's own ground for every deep palette, and `PALETTE_CONTRACT`
 * proves that fill clears 3:1 **against the app canvas**. No test asked whether the fill was
 * distinguishable from the *card* the button was sitting under — and it is not merely similar
 * there, it is the identical hex. A control can be perfectly legible and still be the wrong
 * object.
 *
 * So this file asserts the rule that replaced it — measured, then structural, then in the
 * rendered tree. It is mostly a source-and-data contract rather than a rendered one
 * deliberately: a rule this cheap to restate should not depend on a browser, and
 * `tests/e2e/card-detail.spec.ts` has repeatedly proved to be the slower place to learn that
 * a hook was renamed out from under an assertion.
 */

const CARD_DETAIL = resolve(
  process.cwd(),
  "src/app/(app)/cards/[cardId]/card-detail-client.tsx",
);

/** Comments out, code in — a lint that punishes documenting its own rule trains people to
 *  delete the explanation and keep the behaviour, which is backwards. */
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("a card-coloured button never stands on the app canvas", () => {
  /**
   * The measured half: for every deep palette, `canvasActionBg` is the ground itself, so a
   * button wearing it cannot be told apart from the card above it. This is the fact that makes
   * the structural rule below necessary rather than stylistic — if it ever stops being true,
   * this test says so and the rule can be revisited on evidence.
   */
  it("proves the fill is indistinguishable from the card for the deep palettes", () => {
    const identical = PALETTE_ORDER.filter((id) => {
      const p = TEMPLATE_PALETTES[id];
      return p.canvasActionBg.toLowerCase() === p.ground.toLowerCase();
    });

    expect(
      identical.length,
      "no palette reuses its ground as the canvas action fill any more — re-read this file's " +
        "header before relaxing the structural rule below",
    ).toBeGreaterThan(0);
  });

  /**
   * The structural half, and the one that actually holds the line: the card-detail screen may
   * not render a `<CardActionButton>` at all.
   *
   * ⚠ Positional, not per-palette, and that is the point. A per-palette fix ("darken the fill
   * on deep grounds") has to be re-derived every time a ground is added, and it would still
   * leave a card-coloured control on a surface whose entire token layer exists to disappear so
   * that a card is the only coloured thing on screen. The palette buttons keep their home:
   * inside `<CardPage>`'s action slot, on the palette's own ground, which is where the public
   * page uses them and where they are correct.
   */
  it("the card-detail screen renders no CardActionButton", () => {
    const code = strip(readFileSync(CARD_DETAIL, "utf8"));

    expect(
      /<CardActionButton/.test(code),
      "the card-detail screen is on the app canvas: use `components/primitives/button`",
    ).toBe(false);
    expect(
      /card-action-button/.test(code),
      "the card-detail screen must not import the card action button",
    ).toBe(false);
  });

  /**
   * The same report, one client review later: **the block holds a card, and no controls at
   * all.**
   *
   * ⚠ This replaces an assertion that the owner's "Save to contacts" was rendered *outside*
   * the block's horizontal scroll rail. That rule is not relaxed, it has lost its subject —
   * the `action` slot it policed is gone, along with the save button, the two Add-to-Wallet
   * buttons and the prose under them (client review 2026-09-20: *"this page is looking very
   * cluttered… there is random text in this"*). The two wallet buttons were the sharper
   * problem: neither could install anything in this build, and both said so in body copy
   * beneath themselves, which is a control whose only function is to apologise for existing.
   *
   * So what is asserted now is the shape that removal left: the rail still wraps the face —
   * that is what the rail is for, and `mobile-contracts` proves the same thing from the
   * source — and nothing else in the block is pressable. A control added here later belongs
   * outside the rail and must wear the app's chrome, which is what the two tests either side
   * of this one hold.
   */
  it("the wallet block wraps the face in the rail and offers no control of its own", () => {
    const { container } = renderWithProviders(
      <WalletPassBlock>
        <div data-probe-face="" />
      </WalletPassBlock>,
    );

    const rail = container.querySelector("[data-wallet-pass-rail]");
    expect(rail, "the block no longer has a scroll rail").not.toBeNull();
    expect(rail!.querySelector("[data-probe-face]"), "the face left the rail").not.toBeNull();

    expect(
      container.querySelectorAll("button, a, [role='button']").length,
      "the wallet block grew a control back — read this test's header before adding one",
    ).toBe(0);

    /* The eyebrow survived, because a 336x500 object with a QR on it still needs a name. */
    expect(container.textContent).toBe("Wallet pass");
  });

  it("the card-detail screen passes the face alone as children", () => {
    const detail = strip(readFileSync(CARD_DETAIL, "utf8"));
    const open = detail.indexOf("<WalletPassBlock");
    const close = detail.indexOf("</WalletPassBlock>");
    expect(open, "the card-detail screen no longer renders the wallet block").toBeGreaterThan(-1);

    /* Everything after the opening tag's own `>` and before the close is `children`.
       ⚠ This used to seek from `action={`, the prop that carried the owner's save button. The
       prop is gone with the button, so the scan starts at the element itself — and `<WalletPassBlock`
       is now the whole opening tag, which is exactly the state this test wants to keep. */
    const body = detail.slice(detail.indexOf(">", open) + 1, close);
    expect(
      (body.match(/<ShareFace/g) ?? []).length,
      "the wallet block's children must be exactly one ShareFace",
    ).toBe(1);
    expect(
      /<Button|<CardActionButton|<button/.test(body),
      "a control is passed as children — it would be sized by the rail and need a sideways " +
        "scroll to reach its own right edge; put it in the block, outside the rail",
    ).toBe(false);
  });
});
