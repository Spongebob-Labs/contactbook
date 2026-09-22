import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { AA_LARGE_TEXT, AA_TEXT, contrastRatio } from "@/lib/contrast";

/**
 * **THE TWO SKINS ARE ONE CONTRACT, AND THIS IS THE CONTRACT.**
 *
 * `styles/marketing-skins.css` lets the marketing layer wear two palettes — `verdant` (the
 * client's 168° deck green) and `atelier` (the cream-and-gold reference hero) — on one set of
 * components, by naming five *roles* and letting the skin supply the hue. Nothing in the
 * components knows which skin is live; they read `--mk-accent-*` and the ground tokens.
 *
 * That is only safe while every rung of every skin actually clears the threshold its role
 * promises. The values were derived by hand, and a hand-derived ladder is exactly the kind of
 * thing that rots: somebody nudges a gold half a step warmer to match a mockup, and the small
 * text on the wash quietly drops to 4.2:1 on a page nobody re-measures.
 *
 * ## ⚠ THIS FILE WAS PROMISED BY A COMMENT BEFORE IT EXISTED
 *
 * `marketing-skins.css` carried the line "`tests/contract/marketing-skins.test.ts` recomputes
 * all of them" for a day while no such file existed. That is worse than no comment, because the
 * next reader trusts it and stops checking. Written now; the claim is true.
 *
 * ## Why it parses the stylesheets instead of importing a table
 *
 * These tokens live in CSS, not TypeScript — there is no module to import. Restating their
 * values here would create a second copy that drifts from the one the browser actually uses,
 * which is the failure this suite exists to prevent. So the CSS is the input: the test reads
 * the real declarations, merges them the way the cascade does, and recomputes every ratio from
 * scratch with `src/lib/contrast.ts`.
 *
 * The consequence worth knowing: **you can retune either palette freely and this file needs no
 * edit.** It only fails when a value stops satisfying its role.
 */

const STYLES = resolve(__dirname, "../../src/styles");

const BASE_CSS = readFileSync(resolve(STYLES, "marketing.css"), "utf8");
const SKINS_CSS = readFileSync(resolve(STYLES, "marketing-skins.css"), "utf8");

/**
 * Pull `--name: #value;` pairs out of the first rule whose selector matches.
 *
 * Deliberately crude — a real CSS parser is a dependency this repo does not need to assert six
 * colours. It reads declarations, not nesting, and it ignores anything that is not a bare hex,
 * which is correct here: a token resolving to `var(...)` is an alias and is covered by the
 * alias test below rather than by an arithmetic one.
 */
function tokensIn(css: string, selector: string): Record<string, string> {
  /* Comments go first. `marketing.css` documents each token's measured ratio inline, and several
     of those notes quote OTHER hex values ("#5ABCA9 decorative, #419F8D display…"). Parsing with
     the comments still in place reads those as declarations. */
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Record<string, string> = {};

  /* ALL blocks with this selector, in document order — not just the first. `[data-mk-root]` is
     declared more than once in `marketing.css` (the colour block and the font block are
     separate), and reading only the first silently returned the fonts and no colours at all.
     That bug is what made this test's first run fail on a palette that was entirely correct. */
  const opener = new RegExp(
    `(?:^|[},])\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`,
    "g",
  );

  for (const hit of source.matchAll(opener)) {
    const open = hit.index! + hit[0].length - 1;
    const close = source.indexOf("}", open);
    if (close === -1) continue;

    for (const match of source
      .slice(open + 1, close)
      .matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
      out[match[1]!] = match[2]!.toUpperCase();
    }
  }
  return out;
}

/**
 * What a component actually resolves, for one skin.
 *
 * `marketing.css`'s `[data-mk-root]` block holds the defaults; the skin's own block overrides
 * a subset. `atelier` restates the text ladder because its ground is warm; `verdant` inherits
 * it. Merging in that order is the cascade, and getting it wrong would test a palette nobody
 * ever sees.
 */
function resolveSkin(skin: string): Record<string, string> {
  return {
    /* `:root` FIRST — that is where `marketing.css` actually declares the colour tokens
       (`--mk-paper`, `--mk-ink`, `--mk-stone`, `--mk-pebble`, `--mk-wash`). Its
       `[data-mk-root]` blocks carry the typeface tokens and the section grounds. Both are part
       of what a component resolves, so both are merged, in cascade order. */
    ...tokensIn(BASE_CSS, ":root"),
    ...tokensIn(BASE_CSS, "[data-mk-root]"),
    ...tokensIn(SKINS_CSS, `[data-mk-root][data-mk-skin="${skin}"]`),
  };
}

const SKINS = ["verdant", "atelier"] as const;

/**
 * The five roles, and what each one promises a component that reads it.
 *
 * `tint` carries no threshold ON PURPOSE. It is the brand colour at roughly 2:1 in both skins —
 * the logo green and the reference's gold — and it is legal precisely because nothing reads it:
 * it paints rules, badges and a monogram. Asserting a floor on it would be asserting the
 * opposite of its rule. What IS asserted is that it stays BELOW the large-text floor, so that
 * the day someone darkens it into legibility, they are told to give it a real role instead of
 * leaving a decorative name on a working ink.
 */
const ROLES = [
  {
    token: "--mk-accent-display",
    floor: AA_LARGE_TEXT,
    why: "headline accent clauses, at display sizes only",
  },
  {
    token: "--mk-accent-ink",
    floor: AA_TEXT,
    why: "small text, links and control edges",
  },
] as const;

/** Text that sits on the light grounds in every skin. */
const TEXT_LADDER = [
  { token: "--mk-ink", floor: AA_TEXT, why: "primary body copy" },
  { token: "--mk-stone", floor: AA_TEXT, why: "secondary body copy" },
  { token: "--mk-pebble", floor: AA_TEXT, why: "captions and eyebrows" },
] as const;

describe("the marketing skins share one contract", () => {
  it.each(SKINS)("%s declares every role the components read", (skin) => {
    const t = resolveSkin(skin);

    for (const token of [
      "--mk-paper",
      "--mk-wash",
      "--mk-accent-tint",
      "--mk-accent-display",
      "--mk-accent-ink",
      "--mk-accent-deep",
      "--mk-accent-on-deep",
    ]) {
      expect(
        t[token],
        `${skin} never defines ${token}. A component reading it would fall through to ` +
          "whatever the other skin left behind, or to nothing.",
      ).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  /**
   * ⚠ EVERY RUNG IS CHECKED AGAINST BOTH GROUNDS, AND THAT IS THE WHOLE POINT.
   *
   * This page alternates `--mk-paper` and `--mk-wash`. A colour derived against the paper alone
   * can clear its floor there and fail one section down on the wash — which has already happened
   * once on this project: the first green ladder measured 3.01 and 4.52 on white, then 2.85 and
   * 4.26 on the wash. Both grounds, every time.
   */
  describe.each(SKINS)("%s", (skin) => {
    const t = resolveSkin(skin);
    const grounds = [
      ["paper", t["--mk-paper"]!],
      ["wash", t["--mk-wash"]!],
    ] as const;

    it.each(ROLES)("$token clears $floor:1 on both grounds — $why", ({ token, floor }) => {
      for (const [name, ground] of grounds) {
        const ratio = contrastRatio(t[token]!, ground);
        expect(
          ratio,
          `${skin}'s ${token} (${t[token]}) is ${ratio.toFixed(2)}:1 on the ${name} ` +
            `(${ground}), under its ${floor}:1 floor. Darken the token — never lower this.`,
        ).toBeGreaterThanOrEqual(floor);
      }
    });

    it.each(TEXT_LADDER)("$token clears $floor:1 on both grounds — $why", ({ token, floor }) => {
      for (const [name, ground] of grounds) {
        const ratio = contrastRatio(t[token]!, ground);
        expect(
          ratio,
          `${skin}'s ${token} (${t[token]}) is ${ratio.toFixed(2)}:1 on the ${name} ` +
            `(${ground}), under its ${floor}:1 floor.`,
        ).toBeGreaterThanOrEqual(floor);
      }
    });

    it("keeps the tint decorative — it may not quietly become an ink", () => {
      const tint = t["--mk-accent-tint"]!;
      const ratio = contrastRatio(tint, t["--mk-paper"]!);

      expect(
        ratio,
        `${skin}'s tint (${tint}) now measures ${ratio.toFixed(2)}:1 and could pass as large ` +
          "text. That is not a failure of the colour, it is a failure of its NAME: the tint is " +
          "documented as decorative-only and components are allowed to use it where nothing is " +
          "read. Give it a real role, or keep it under the floor.",
      ).toBeLessThan(AA_LARGE_TEXT);
    });

    /**
     * The deep ground is the one dark surface — the close, and the primary action fill. It
     * carries two inks: white, and a softer one. The softer one is the reason the primary is
     * held to more than 4.5 — a ground with exactly enough contrast for one ink has none left
     * for a second, which is the trap `template-palettes.ts` documents for the card grounds.
     */
    it("the deep ground carries both of its inks", () => {
      const deep = t["--mk-accent-deep"]!;

      const white = contrastRatio("#FFFFFF", deep);
      expect(
        white,
        `white on ${skin}'s deep ground (${deep}) is ${white.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(AA_TEXT);

      const soft = contrastRatio(t["--mk-accent-on-deep"]!, deep);
      expect(
        soft,
        `${skin}'s soft ink on deep (${t["--mk-accent-on-deep"]} on ${deep}) is ` +
          `${soft.toFixed(2)}:1 — the second ink is the whole reason the ground is this dark.`,
      ).toBeGreaterThanOrEqual(AA_TEXT);
    });

    /**
     * The ladder must stay in order. Nothing reads a rung by its ratio, but a skin whose
     * "display" is darker than its "ink" is one somebody has edited without understanding the
     * roles, and every later derivation from it will be wrong in a way arithmetic alone would
     * not catch.
     */
    it("the ladder runs light to dark, in role order", () => {
      const paper = t["--mk-paper"]!;
      const rungs = ["--mk-accent-tint", "--mk-accent-display", "--mk-accent-ink"].map(
        (token) => ({ token, ratio: contrastRatio(t[token]!, paper) }),
      );

      for (let i = 1; i < rungs.length; i += 1) {
        expect(
          rungs[i]!.ratio,
          `${skin}: ${rungs[i]!.token} (${rungs[i]!.ratio.toFixed(2)}:1) is not darker than ` +
            `${rungs[i - 1]!.token} (${rungs[i - 1]!.ratio.toFixed(2)}:1). The rungs are out of order.`,
        ).toBeGreaterThan(rungs[i - 1]!.ratio);
      }
    });
  });

  /**
   * The legacy `--mk-green-*` names are a compatibility shim: `marketing.css` and several
   * components still read them, and under `atelier` they hold gold. They must point at the
   * accent ladder rather than carry values of their own, or a component reading the old name
   * gets the old green on a warm page.
   */
  it("the --mk-green-* aliases forward to the accent ladder and hold no values", () => {
    const shim = SKINS_CSS.slice(SKINS_CSS.indexOf('[data-mk-root][data-mk-skin] {'));

    for (const [legacy, role] of [
      ["--mk-green", "--mk-accent-tint"],
      ["--mk-green-display", "--mk-accent-display"],
      ["--mk-green-ink", "--mk-accent-ink"],
      ["--mk-green-deep", "--mk-accent-deep"],
    ]) {
      expect(
        shim,
        `${legacy} must forward to var(${role}); a literal here is a third palette.`,
      ).toContain(`${legacy}: var(${role})`);
    }
  });

  /**
   * Both skins must define the same roles. A component cannot branch on the skin — that is the
   * entire design — so a role present in one and missing from the other is a component that
   * renders correctly on one page and falls back to nothing on the other.
   */
  it("neither skin defines a role the other lacks", () => {
    const [a, b] = SKINS.map((skin) => tokensIn(SKINS_CSS, `[data-mk-root][data-mk-skin="${skin}"]`));

    const accentKeys = (t: Record<string, string>) =>
      Object.keys(t).filter((k) => k.startsWith("--mk-accent-")).sort();

    expect(accentKeys(a!)).toEqual(accentKeys(b!));
  });
});
