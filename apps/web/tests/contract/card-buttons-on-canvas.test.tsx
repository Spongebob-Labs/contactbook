import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveCard } from "@/card/resolve-card";
import { TEMPLATE_PALETTES, PALETTE_ORDER } from "@/card/template-palettes";
import { ToastProvider } from "@/components/overlay";
import { WalletPassBlock } from "@/components/share/wallet-pass-block";
import { cardLedgerDemo, FIXTURE_DB } from "@/fixtures";

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
 * So this file asserts the two halves of the rule that replaced it, one measured and one
 * structural. It is a source-and-data contract rather than a rendered one deliberately:
 * `tests/e2e/card-detail.spec.ts` cannot cover it today (that route redirects to the auth flow
 * in the harness), and a rule this cheap to restate should not depend on a browser.
 */

const resolved = resolveCard(
  cardLedgerDemo,
  FIXTURE_DB.user,
  FIXTURE_DB.groups,
  FIXTURE_DB.fields,
);

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
   * And the placement half of the same report: the owner's action must not be inside the
   * wallet block's horizontal scroll rail.
   *
   * That rail exists so the rigid 336px face can overhang a 296px column without scrolling the
   * document. The save button was passed as `children` and went into it, so on a 320px screen
   * it came out 40px narrower than the card and needed a sideways scroll to reach its own right
   * edge. `action` renders outside the rail; `children` is the card and nothing else.
   */
  it("the wallet block renders the owner's action outside the scroll rail", () => {
    const { container } = renderWithProviders(
      <ToastProvider>
        <WalletPassBlock
          resolved={resolved}
          action={<button data-probe-action="">Save to contacts</button>}
        >
          <div data-probe-face="" />
        </WalletPassBlock>
      </ToastProvider>,
    );

    const rail = container.querySelector("[data-wallet-pass-rail]");
    expect(rail, "the block no longer has a scroll rail").not.toBeNull();

    /* The face is inside the rail — that is what the rail is for. */
    expect(rail!.querySelector("[data-probe-face]"), "the face left the rail").not.toBeNull();

    /**
     * ⚠ AND THE ACTION IS NOT. This is the assertion that matters, and an earlier version of
     * this test could not make it: it compared the source positions of `data-wallet-pass-rail`
     * and `data-wallet-pass-action`, which are in the same order whether the action is a
     * sibling of the rail or nested inside it — so it passed with the bug reintroduced. Asking
     * the rendered tree is the only way to tell the two apart.
     */
    expect(
      rail!.querySelector("[data-probe-action]"),
      "the owner's action is inside the horizontal scroll rail: pass it via `action`, and keep " +
        "`children` to the card alone",
    ).toBeNull();

    /* It is still present, and still under the face. */
    const action = container.querySelector("[data-wallet-pass-action] [data-probe-action]");
    expect(action, "the `action` slot did not render what it was given").not.toBeNull();
    expect(
      rail!.compareDocumentPosition(action!) & Node.DOCUMENT_POSITION_FOLLOWING,
      "the owner's action is rendered above the face",
    ).toBeTruthy();
  });

  it("the card-detail screen passes the face alone as children", () => {
    const detail = strip(readFileSync(CARD_DETAIL, "utf8"));
    const open = detail.indexOf("<WalletPassBlock");
    const close = detail.indexOf("</WalletPassBlock>");
    expect(open, "the card-detail screen no longer renders the wallet block").toBeGreaterThan(-1);

    /* Everything after the opening tag's own `>` and before the close is `children`. */
    const body = detail.slice(detail.indexOf(">", detail.indexOf("action={") ) + 1, close);
    expect(
      (body.match(/<ShareFace/g) ?? []).length,
      "the wallet block's children must be exactly one ShareFace",
    ).toBe(1);
    expect(
      /<Button|<CardActionButton|<button/.test(body),
      "a control is passed as children — it belongs in the `action` slot, outside the rail",
    ).toBe(false);
  });
});
