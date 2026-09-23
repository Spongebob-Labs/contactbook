import type { CSSProperties, ReactElement, ReactNode } from "react";

import { ArrowUpRight, ChevronRight } from "lucide-react";

import { CardGround } from "@/card/card-ground";
import {
  actionAccessibleName,
  cardPageSections,
  heroBio,
  splitHeroFields,
  type CardPageRow,
  type CardPageSection,
} from "@/card/card-page-rows";
import type { ResolvedSurface } from "@/card/card-surface";
import type { FieldIconSize } from "@/card/field-renderers";
import { renderFieldRow } from "@/card/field-renderers";
import { socialGlyph } from "@/card/social-glyphs";
import { whatsappActionFor } from "@/components/public-card/whatsapp-button";
import { paletteVars } from "@/card/template-palettes";
import { parseSocialLink } from "@/lib/format";
import type { ResolvedCard, ResolvedField } from "@/types/domain";

import "@/styles/card.css";

/**
 * THE CARD PAGE — the product itself, and what `/c/{slug}` serves to whoever opens the link.
 *
 * ## ⚠ Rebuilt 2026-09-17. What changed, and what did not
 *
 * The client's note on 2026-09-09 was that the QR face and the templates were *"striking"* and
 * the page a scan landed on *"looks like a plain, basic card"*. §1b of `card.css` answered the
 * first half of that — the page became an inset, rounded object instead of a full-bleed
 * rectangle. This file is the second half: the composition INSIDE that object.
 *
 * What the page is now, top to bottom:
 *
 *     ┌──────────────────────────────┐
 *     │                              │  COVER — the owner's photograph, or the
 *     │         photograph           │  palette gradient when they have none.
 *     │                              │  Holds still while everything below scrolls over it.
 *     ├────────╮   ╭─────────────────┤  CURVE — the sheet rises over the cover on one
 *     │        ╰(B)╯                 │  asymmetric wave, hairlined in the accent.
 *     │    M A Y A   P A R T N E R S │  BADGE straddles it. WORDMARK is the owner's company.
 *     │        Maya Laurent          │  NAME, in the display serif.
 *     │        Founder & CEO         │  ROLE.
 *     │   Connecting people, ideas…  │  BIO, serif.
 *     │  ┌────────────────────────┐  │
 *     │  │   Save to Contacts  →  │  │  ONE primary action. See `public-card-actions.tsx`.
 *     │  └────────────────────────┘  │
 *     │  P E R S O N A L             │  SECTIONS, headed by field category.
 *     │  ◯ +44 7700 900123        ›  │  Rows print the VALUE. The chevron means it goes
 *     │  ◯ maya@…                 ›  │  somewhere; a row without one is not a control.
 *     │  S O C I A L                 │
 *     │      ⓘ  ⓘ  ⓘ  ⓘ            │  STRIP — every social link the owner mapped.
 *     │      Made with Contact Book  │
 *     └──────────────────────────────┘
 *
 * **Unchanged, and deliberately:** it is still a page and not a canvas — no height, no
 * `max-height`, no `overflow` anywhere in this file. It still renders in three places from one
 * definition (the public route, the builder's preview, the marketing cards). There is still no
 * QR on it, for the reason the old module note gave and which has not stopped being true: the
 * reader has already opened the card, so a symbol encoding this page's own URL is a button that
 * reloads the current document.
 *
 * ## ⚠ THE ROWS PRINT THE VALUE NOW, AND THAT REVERSES A DOCUMENTED RULE
 *
 * This file used to state, at length, that a row shows "Work email" and never the address —
 * that the action is what the button does, and a stack of buttons wearing 34-character
 * addresses is a list of strings you have to read. That argument was coherent and it is
 * overruled: a card is handed over so somebody can *see* how to reach you, and a column of
 * verbs ("Email", "Phone", "Website") tells a reader nothing they did not already assume.
 *
 * **Printing the value is safe by construction, and it is worth knowing why rather than
 * re-deriving it under pressure.** `row.display` and `row.lines` do not come from
 * `field.value`; they come from `field-renderers.tsx`, whose `renderer()` factory applies
 * masking LAST and surrenders display, title and href together (§7.3, AC-33), and whose
 * `LOCATION_TRACKING` renderer collapses a coordinate pair to a status chip before any
 * component sees it (§7.3). So the strings this file prints are the same strings the page was
 * already serving in `title` attributes. Nothing newly reaches the DOM.
 *
 * What DOES change is that the value now lands in `innerText`, which two suites scan. The
 * coordinate assertion in `tests/e2e/public-card.spec.ts` still passes for the reason above —
 * there is no coordinate in `display` to find.
 *
 * `actionAccessibleName()` is still applied, now for the opposite reason: the row prints the
 * value and no longer prints the label, so a screen-reader user needs the label spoken to know
 * *which* of three addresses this is.
 *
 * ## The two surfaces, and where colour lands
 *
 * The card has a **cover** and a **sheet**, and the palette owns only the cover.
 *
 *   · `--c-*` (from `paletteVars`) paint the cover. Full saturation, full gradient.
 *   · `--cb-sheet` is paper: white carrying 3% of the palette's ground, so a Rust card's sheet
 *     is faintly warm and a Sapphire card's faintly cool without either becoming a tint block.
 *   · `--cb-accent` is `--c-canvas-action-bg`, and that reuse is the whole trick. It is the
 *     one palette colour `PALETTE_CONTRACT` already proves against **white** rather than
 *     against the card's own ground — which is exactly the question the sheet asks — and it is
 *     a deep colour on all nine palettes (Onyx's own near-black; a hue-matched deep brown,
 *     plum, forest or indigo on the four lights). So the primary action is a near-black pill on
 *     an Onyx card and a deep-brown one on an Amber card, and both are proven legible on paper
 *     without a single new colour being invented here.
 *
 * ⚠ **Body text on the sheet uses the APP's ink tokens, not the palette's.** `--c-ink` and
 * `--c-ink-soft` are defined against the palette's *ground*; on a near-white sheet, Onyx's
 * `--c-ink` is pure white and would vanish. `--ink` and `--ink-2` are proven on `--canvas`,
 * and the sheet is within 3% of it. `--ink-3` is deliberately NOT used: at 4.99:1 on pure white
 * it drops to roughly 4.4:1 against a 3%-tinted sheet, which is under AA — the one place this
 * composition could have quietly shipped illegible text, and the reason `--ink-2` carries every
 * secondary line here.
 *
 * ## The DOM contract other tracks code against
 *
 * Kept, and asserted elsewhere — do not rename: `[data-card-root]`, `[data-card-variant]`,
 * `[data-template-id]`, `[data-palette-id]`, `[data-page-header]`, `[data-render-mode]`,
 * `[data-card-fields]` carrying `data-field-count`, `[data-card-field="{id}"]`,
 * `[data-card-field-row]`, `[data-card-field-masked]`, `[data-card-field-value]`,
 * `[data-card-hero]`, `[data-card-name]`, `[data-card-portrait]`, `[data-card-brand]`,
 * `[data-card-row-kind]`, `[data-card-action-button="{id}"]`, `[data-card-note="{id}"]`.
 *
 * ⚠ `[data-card-fields]` is now a **wrapper around sections** rather than the `<ul>` itself, so
 * its rows are `[data-card-fields] li` and no longer `> li`. `card.css` §2 was updated with it;
 * that descendant selector is the one place this change is visible from outside.
 *
 * ⚠ `[data-card-body]` and `[data-card-on-palette]` are kept, with one value changed.
 * `data-card-body` now names the sheet — the successor of "the block below the hero" — because
 * two suites address it by that name and renaming it would break them to no end.
 * `data-card-on-palette` is `"false"` on both the hero and the body, and that is the honest
 * answer in a two-tone composition: nothing but the cover stands on the palette.
 *
 * ⚠ `[data-card-brand]` is kept and its CONTENT changed. It used to read "Contact Book"; it
 * prints the owner's company now, and the product's attribution moved to `[data-card-credit]`
 * at the foot. A test asserting the old string fails loudly, which is what should happen.
 *
 * New, and safe to assert on:
 * `[data-card-cover]` carrying `data-cover` (`photo | none`), `[data-card-cover-photo]`,
 * `[data-card-sheet]`, `[data-card-curve]`, `[data-card-badge]`, `[data-card-role]`,
 * `[data-card-bio]`, `[data-card-section="{CATEGORY}"]`, `[data-card-section-label]`,
 * `[data-card-socials]` carrying `data-social-count`, `[data-card-social="{id}"]`,
 * `[data-card-credit]`.
 *
 * ⚠ `[data-card-credit]` is now **wrapped** by `[data-card-footer]` and followed by
 * `[data-card-credit-logo]`, the product's mark. Its own text is unchanged and must stay exactly
 * `"Made with Contact Book"` — two suites assert the string, and the attribution has to survive
 * as text whether or not the mark loads. The mark is a SIBLING, never a child. See
 * {@link MadeWithCredit}.
 */

export interface CardPageProps {
  resolved: ResolvedCard;
  /**
   * The real action controls, injected by the route.
   *
   * A slot rather than buttons built in, because "Save to contacts" writes a `.vcf` through a
   * blob URL and needs client state, while this component is otherwise renderable on the
   * server. The builder's preview passes inert look-alikes through the same slot, so the
   * preview and the live page cannot drift apart in layout.
   */
  actions?: ReactNode;
  className?: string;
  /**
   * Whether `[data-card-credit]` ("Made with Contact Book") renders at the foot.
   *
   * ⚠ **Defaults to `true`, and that default is load-bearing, not a placeholder.** A card
   * opened from a real share link is this product's one unpaid channel back to itself — see
   * `MadeWithCredit`'s own note — and `tests/e2e/public-card.spec.ts` asserts `[data-card-credit]`
   * exists on `/c/{slug}` unconditionally. Nothing on `/c/{slug}` sets this prop, so that
   * assertion holds exactly as it did before this prop existed.
   *
   * The one honest reason to pass `false`: a caller composing the card against the client's own
   * reference, which shows no credit line at all (it ends at the SOCIAL row) — today that is
   * `<HeroCard>` (`src/components/marketing/hero-card.tsx`), matching a fixed-height phone
   * screen the reference was measured against. That file is not this pass's to edit, so the
   * prop exists with its safe default and the call site is a follow-up, not a dependency of
   * this pass's own arithmetic (see {@link COVER_RATIO}'s dated note).
   */
  showCredit?: boolean;
}

/* ── measurements ───────────────────────────────────────────────────────────── */

/**
 * The row icon, inside a 36px disc.
 *
 * ⚠ 16 because §8.8 allows exactly three icon sizes in this product — `FieldIconSize` is
 * `16 | 20 | 24` and the union is the enforcement. 18 would have been the neat optical answer
 * for a 36px disc and is not an option, which is the point of the union; 16 on 36 is the
 * reference's own ratio anyway — a small mark in a generous circle, not a filled roundel.
 */
const ROW_ICON_SIZE: FieldIconSize = 16;

/**
 * The tinted disc a row icon sits in.
 *
 * ⚠ 32, down from 36. Measured against the reference, this build was running about 1.8× its
 * vertical rhythm: a 36px disc inside a 52px row, stacked twelve deep, pushed the second section
 * off a phone screen entirely. The disc is decorative — the ROW is the control — so it can come
 * down to whatever still reads as a circle behind a 16px mark.
 */
const ROW_DISC = 32;

/**
 * One line of a row's value, in px — `--text-base` (15) at its 1.6 line-height, rounded.
 *
 * Stated because {@link RowDisc} needs it to centre a 32px disc on a single line of text when the
 * text runs to several, and deriving it at runtime would mean measuring.
 */
const ROW_LINE = 24;

/**
 * The tap-target floor for a row, in px — and it is now exactly the floor.
 *
 * ⚠ It was 52, on the argument that a thumb scrolling a page of rows wants margin for error.
 * That argument is real and it lost to a bigger one: at 52 plus gaps, a card with nine fields
 * showed three of them above the fold. The reference's rows measure about 30pt, which ignores
 * tap targets entirely — a mockup can. 44 is the smallest this can honestly go (2.5.5), so it
 * is what it goes to, and the space is bought back from the disc and the gaps instead.
 */
const ROW_MIN_HEIGHT = 44;

/** The badge that straddles the curve. 64, down from 72 — see {@link ROW_MIN_HEIGHT}. */
const BADGE = 64;

/* ── the product's mark, at the foot ────────────────────────────────────────── */

/**
 * The brand lockup the card signs itself with. See {@link MadeWithCredit}.
 *
 * ⚠ **Transparent, and un-matted from the supplied artwork rather than used as supplied.** The
 * brand file is the lockup on an opaque white ground; `--cb-sheet` is white carrying 3% of the
 * card's palette, so dropping the file in as-is paints a white rectangle at the foot of eight
 * of the nine palettes. The asset here has its white dissolved to alpha along each ink's own
 * blend ray, so the anti-aliased edges survive and the mark sits on whatever paper the card is
 * printed on.
 */
const CREDIT_LOGO_SRC = "/brand/contactbook-logo.png";

/**
 * The asset's own pixel size, stated so the foot reserves its box before the image arrives.
 * A mark that pops in shifts the card by its own height, which on a page a reader is already
 * scrolling is a jump under their thumb.
 */
const CREDIT_LOGO_INTRINSIC = { width: 470, height: 131 } as const;

/**
 * The mark's rendered width, px.
 *
 * ⚠ A fixed number rather than a percentage, and the card's two read widths are why: the card is
 * 336px wide inside the builder's phone frame and `--page-measure` (460px) at its widest, so a
 * percentage would draw the mark half again as large on a desktop as on the phone the card is
 * mostly read on. 132 is a little over a third of the narrow width — enough to be legible as a
 * wordmark at its 3.6:1 aspect, and small enough that it reads as a signature rather than as
 * the card's own branding competing with the owner's.
 *
 * ⚠ 156 and not less, because of the lockup's **tagline**. "NEVER LOSE CONTACT" is set at about
 * 1/32 of the artwork's width, so at the 132 this started on it rendered near 4px and read as a
 * smudge under the wordmark rather than as words — which looks like a compression artifact, not
 * a mark. 156 puts it a little over 5px, which resolves on the 2× and 3× screens a card is
 * actually read on. Below ~150 the honest fix is a tagline-free variant of the lockup, not a
 * smaller one.
 */
const CREDIT_LOGO_WIDTH = 156;

/**
 * THE CARD'S VERTICAL RHYTHM — one number per relationship, and nothing implicit.
 *
 * ## ⚠ Why this exists rather than a `gap` and some margins
 *
 * The hero used `gap: var(--space-2)` on its flex column AND a `margin-top` on three of its
 * children. Two mechanisms stacking meant no single place said how far apart two things were:
 * the space under the role was `8 + 12`, written in two files' worth of thinking and readable in
 * neither. The reported symptom was *"there is a lot of gap"* between the position and the bio;
 * the cause was that nobody could see what the gap WAS.
 *
 * So the container's `gap` is zero and every space below is a margin on the thing beneath it.
 * One relationship, one number, one place to change it.
 *
 * ## The numbers are measured off the reference, not chosen
 *
 * Baseline to baseline at a 390pt phone, from the mockup: wordmark → name 36, name → role 27,
 * role → company 17, company → bio 24, bio → action ~20. The second pair is the tell — a role
 * and a company sit one line apart, i.e. they read as ONE block, and the bio is what gets the
 * air. This build has no separate company line (the company is the wordmark), so the values
 * below collapse that pair into the name/role block and give the bio the same 24-ish of
 * separation it has there.
 *
 * ⚠ These are px and not `--space-*` tokens, deliberately. The app's scale steps 4/8/12/16/20/24
 * and three of the values here need to land between its steps to match the reference's
 * proportions. A token that is nearly right is worse than a number that is exactly right and
 * says so.
 */
/**
 * ⚠ RETIGHTENED 2026-09-21, ONE ROUND AFTER THE VALUES ABOVE'S OWN COMMENTS WERE WRITTEN.
 *
 * The reference proved this rhythm at `COVER_RATIO.none` (0.3) — no photograph. Turning a photo
 * cover on (0.7 at the time) adds `0.4 × width` before a single row renders, which the reference
 * never had to absorb: at a 336px hero this is +134px, and it is what pushed the social strip
 * ~112px past a 728px phone screen even after every other line on the card had already been
 * trimmed once. That deficit is arithmetic, not aesthetics, and it is too large for margins
 * alone to close without either gutting a gap into invisibility or reducing the cover itself
 * (see {@link COVER_RATIO}'s own updated note) — so both levers moved together that round.
 *
 * ⚠ RETIGHTENED AGAIN, LATER THE SAME DAY — `COVER_RATIO.photo` MOVED FROM 0.45 TO 0.60.
 *
 * 0.45 wasn't the reference's own proportion — it was how far the cover had to shrink to fit a
 * 728px screen at the OLD margins, and the client measured it against their reference and called
 * it: *"the cover image is hiding behind the card... the full cover image should be visible."*
 * 0.60 is the reference's measured ratio; the ~50px that costs at 336px width (`(0.60 - 0.45) ×
 * 336`) has to come from here again rather than from the cover a second time, which is why every
 * number below moved again, in the same direction, none of them past what its own divider needs
 * to still read as one.
 *
 * The other lever this round is `[data-card-credit]` itself: the reference's card ends at the
 * SOCIAL row and carries no attribution line at all. It is not deleted — a card opened from a
 * real share link still has to credit the product (see `MadeWithCredit`'s own note) — but it is
 * now a `showCredit` prop, defaulted to shown, so a caller with a reason to match the reference
 * exactly (the marketing hero, composing against a fixed-height phone screen) can opt out
 * without every other card losing its one way back to the product. Suppressing it recovers the
 * credit line's own box plus `socialToCredit` below — see that constant's note.
 *
 * Every value below is measured, not guessed: `SPACE` after this edit, a real card with a cover
 * photo, five field rows across two sections, a bio and a company wordmark, rendered at 336px —
 * see the module header's dated note for the exact figures this round produced. None of these
 * dropped to zero; a rule with no air on either side of it stops reading as a divider between
 * two sections and starts reading as a single accidental one.
 */
const SPACE = {
  /** Badge to the company wordmark. Was 10, then 6. */
  badgeToBrand: 4,
  /** Wordmark to the name. Small — they are one identity block. Unchanged: already this tight. */
  brandToName: 4,
  /** Name to the position. Smaller still: the tightest pair on the card. Unchanged. */
  nameToRole: 2,
  /** Position to the bio. ⚠ Was an effective 20 and read as a hole; 10, then 6, fixed that. */
  roleToBio: 4,
  /** The hero to the primary action. Was 18, then 10. */
  heroToAction: 8,
  /** The action to the rule above the first section — both above AND below it (see the rule's
   *  own `borderTop`/`paddingTop`), so this single number costs twice its face value. Was 18,
   *  then 8. */
  actionToStack: 6,
  /** Between two field sections, each side of their rule — also doubled, same reason. Was 14,
   *  then 6, then 4.
   *
   *  ⚠ **Back up to 9, and this is the one number the compression pass took too far.** At 4 a
   *  section rule had 4px above it and 4px below, so the divider above WORK sat almost on the
   *  word WORK and the whole stack read as one undifferentiated column with stray lines in it —
   *  reported directly, with that section circled. 9 gives the rule 18px of its own, which is
   *  the least at which a divider reads as separating two things rather than as an accident. */
  sectionGap: 9,
  /** A section's label to its first row. Unchanged: already minimal. */
  labelToRows: 2,
  /** The last section to the social strip, each side of its rule — doubled, same reason. Was 16,
   *  then 6, then 4; 10 for the reason `sectionGap` gives, and it is the same rule. */
  stackToSocial: 10,
  /** The strip to the credit lockup at the foot — paid only when `showCredit` is true. Was 22,
   *  then 10, then 6.
   *
   *  ⚠ 20, because the foot is no longer one muted line: it is a label plus the product's mark,
   *  and a lockup needs to be clearly *after* the card's content rather than trailing it. See
   *  {@link MadeWithCredit}. */
  socialToCredit: 20,
  /** The credit label to the mark beneath it. They are one lockup, so this is deliberately the
   *  tightest gap in the foot — any more and the label stops reading as the mark's caption. */
  creditToLogo: 9,
  /** The sheet's own bottom padding, below whatever the last element is — the card's last,
   *  unlabelled margin, previously an unstated `var(--space-10)` (40px) fallback, then 12,
   *  then 8. See the `paddingBottom` site below for why this needed its own named constant
   *  rather than staying a bare token.
   *
   *  ⚠ 22. At 8 the mark sat 8px off the card's bottom edge and looked dropped in rather than
   *  placed; a mark needs at least as much room beneath it as the gap above it, or it reads as
   *  having fallen out of the composition. */
  bodyPadBottom: 22,
} as const;

/**
 * The cover's height, as a ratio of the card's width — and it is **two** numbers, not one.
 *
 * A photograph wants room: the reference's cover is roughly four-fifths of the card's width and
 * the face fills it. An empty gradient does not. Holding one ratio for both would mean a user
 * with no photograph gets 0.78 of a card width of undifferentiated colour before their name
 * appears, which is not restraint, it is a blank.
 *
 * ⚠ This is NOT the field-count mistake wearing a new hat. The ground is still painted edge to
 * edge at zero fields; what varies here is how much of the card is *cover*, decided by whether
 * there is a photograph to show — a property of the content in that zone, not of the stack
 * below it.
 */
/**
 * ⚠ **Exported, because the crop dialog composes into this exact aperture.**
 *
 * `<ImageCropDialog>` shows the owner a frame and promises that what sits inside it is what the
 * card shows. That promise is only kept while the two numbers are the same number — a cropper
 * on a restated `0.7` goes silently wrong the moment this one is tuned, and the failure is
 * invisible in review because both files look right on their own. `cover-picker.tsx` imports
 * this constant rather than restating it, which is what keeps that promise true automatically
 * across the change below.
 *
 * ⚠ **`photo` DROPPED 2026-09-21, FROM 0.7 TO 0.45, THEN RAISED THE SAME DAY TO 0.60 — AND THIS
 * IS THE ONE NUMBER IN THIS FILE THAT IS NOT "JUST SPACING."** It affects every card in the
 * product with a cover photo, not only the one this pass was asked about, so it is called out on
 * its own rather than folded into {@link SPACE}'s note.
 *
 * The first drop's reason: `SPACE`'s retightening alone bought back ~112px, and a photo cover at
 * 0.7 still cost 336×0.7 ≈ 235px at a 336px card width — arithmetic that keeps a photo-covered
 * card off a 728px phone screen (measured: 808.7px, 80.7px over) no matter how far the margins
 * between rows are cut, short of cutting them to nothing. 0.45 costs ≈151px instead and closed
 * the rest.
 *
 * ⚠ **0.45 was never the reference's own proportion — it was how far the cover had to shrink to
 * fit, and it showed.** Measured against the client's reference mockup, the reference's cover is
 * 0.602 of the card's width; this build's was 0.352 rendered, because `COVER_RATIO.photo` was
 * 0.45 of a *narrower* effective width once the sheet's rounded corners are accounted for, and
 * the client named the consequence directly: *"the cover image is hiding behind the card which
 * should not be happening… the full cover image should be visible… exactly like the reference
 * image I shared."* 0.7 over-corrected the other way (see above); 0.45 under-corrected. 0.60 is
 * the reference's own measured ratio, not a number chosen to make a screen height come out even.
 *
 * Raising it back to 0.60 re-opens the same ~50px deficit at a 336px hero (`(0.60 − 0.45) ×
 * 336`), and this time it is closed WITHOUT touching the cover a third time: `SPACE` retightened
 * again (see its own dated note) and `[data-card-credit]` — which the reference does not show at
 * all — became suppressible via `showCredit`, still defaulted to shown everywhere that prop is
 * not explicitly set to `false`. See `CardPageProps.showCredit` and `MadeWithCredit`'s own note.
 *
 * `none` (the gradient case, no photograph) is UNCHANGED at 0.3 — it was never the problem;
 * a flat colour band costs nothing this file has to buy back.
 */
export const COVER_RATIO = { photo: 0.6, none: 0.3 } as const;

/** The wave's height at design width, px. The curve is drawn into this strip and no taller. */
const CURVE_H = 46;

/**
 * How far below the sheet's top edge the wave's CREST sits, px — and where the badge's top
 * edge is placed. See the note inside {@link SheetCurve} for why the curve crests rather than
 * dips, which is the whole reason this constant exists rather than a hand-tuned offset.
 */
const CREST_Y = 6;

/**
 * The name's size.
 *
 * ⚠ **Not a `vw` clamp, and not a container query.** The card renders at `--page-measure`
 * (460px) at most and at 336px inside the builder's phone frame, while the viewport behind both
 * may be a 1440px desktop — so a `vw` clamp resolved at its ceiling and set a two-word name at
 * 44px in a 288px column, which is three lines of shouting. Container units would fix that and
 * are not used for the second reason: `container-type: inline-size` applies `contain: layout`,
 * and the sizes here are chosen against the two widths the card is actually read at rather than
 * against whatever box it happens to be in.
 */
const NAME_SIZE = "1.875rem";

/* ── surface resolution ─────────────────────────────────────────────────────── */

export interface CardPageSurface extends ResolvedSurface {
  /** The cover's aspect, already decided from whether there is a photograph. */
  coverRatio: number;
}

/**
 * The single resolution of "what does this card look like", exported so the page's actions and
 * its chrome cannot come to a different answer than the card does.
 */
export function cardPageSurface(resolved: ResolvedCard): CardPageSurface {
  return {
    ...resolved.surface,
    coverRatio: resolved.cover.kind === "photo" ? COVER_RATIO.photo : COVER_RATIO.none,
  };
}

/**
 * The card's own custom properties — the sheet half of the two-tone system.
 *
 * Declared as data on the root rather than in `card.css` because every one of them is derived
 * from `--c-*`, which is set inline by `paletteVars`. A stylesheet cannot see a palette; it can
 * only see the variables the palette produced, and keeping the derivation next to the variables
 * it derives from is what stops the two drifting.
 *
 * ⚠ Each `color-mix` fails benign: an engine that cannot parse one drops that declaration, the
 * property falls back to its inherited value, and the card renders a shade flatter rather than
 * broken. None of them is load-bearing for legibility — the inks and the action fill are all
 * plain colours.
 */
function sheetVars(): CSSProperties {
  return {
    /* Paper — `--c-sheet`, resolved by `paletteVars`. It is the palette's own `sheet` when it
       states one (Ivory's cream) and otherwise white carrying 3% of the ground. 3% and not
       more: at 4% a deep ground pulls the sheet to #F6F6F6, where `--ink-3` measures 4.43:1 and
       misses AA. 3% keeps every app ink token inside its proven margin, and an overridden sheet
       is re-proved against both app inks by `PALETTE_CONTRACT`. */
    "--cb-sheet": "var(--c-sheet)",
    "--cb-sheet-ink": "var(--ink)",
    /* `--ink-2` at 10.33:1, never `--ink-3` — see the ⚠ in the module note. */
    "--cb-sheet-ink-soft": "var(--ink-2)",
    /* ⚠ **Two accents, not one, and the split is load-bearing.**
       `--cb-accent` paints MARKS — icon discs, hairlines, the curve's edge, the social glyphs —
       and is held to 3:1 (1.4.11). `--cb-accent-text` paints WORDS — the company wordmark, the
       badge monogram — and is held to 4.5:1 (1.4.3). On eight palettes they are the same colour
       and the split costs nothing; on Ivory they are two steps of one gold, because the light
       gold the reference uses for its wordmark measures about 2.1:1 on cream. */
    "--cb-accent": "var(--c-accent)",
    "--cb-accent-text": "var(--c-accent-text)",
    "--cb-accent-ink": "var(--c-canvas-action-ink)",
    /* The disc behind a row icon: the accent at 9%, which lands between #F0EFEE and #EFEAE4
       across the nine and reads as the reference's soft gold circle without being gold. */
    "--cb-accent-wash": "color-mix(in srgb, var(--cb-accent) 9%, var(--cb-sheet))",
    /* Dividers and the curve's hairline. Decorative, so 1.4.11 does not apply (the same
       exemption `--line` takes at 1.24:1) — this is about 2:1 and reads as a drawn line. */
    "--cb-accent-line": "color-mix(in srgb, var(--cb-accent) 18%, transparent)",
  } as CSSProperties;
}

/* ── the page ───────────────────────────────────────────────────────────────── */

export function CardPage({
  resolved,
  actions,
  className,
  showCredit = true,
}: CardPageProps): ReactElement {
  const { template } = resolved;
  const palette = resolved.palette;
  const surface = cardPageSurface(resolved);

  /* The first JOB_TITLE and COMPANY are consumed by the hero and removed from the stack. One
     call, here, so the hero and the sections cannot disagree about what was promoted. */
  const hero = splitHeroFields(resolved.fields, resolved.bio);
  /* ⚠ The derived bio is suppressed when it is a restatement of the two lines above it.
     `resolveBio` composes "{JOB_TITLE} at {COMPANY}" when the owner mapped no `TEXT` field —
     correct while neither was in the hero, and a verbatim repeat now that both are. See
     `heroBio` for why this is a display rule rather than a change to the resolver. */
  const bio = heroBio(resolved.bio, resolved.headline, hero.org);
  const sections = cardPageSections(hero.rest, ROW_ICON_SIZE);
  const rowCount = sections.reduce((n, section) => n + section.rows.length, 0);

  const root: CSSProperties = {
    ...(paletteVars(palette) as CSSProperties),
    ...sheetVars(),
    fontFamily: "var(--font-sans)",
    width: "100%",
    /* A positioning context for the cover's ground, and for nothing else. */
    position: "relative",
    /* ⚠ The card's own background is the SHEET, not the palette. The sheet element below is
       opaque and covers this, so what this actually guarantees is that no sliver of page canvas
       can show through at the bottom of a short card — the "the background disappears when I
       remove the fields" report, answered on the axis it actually lives on. */
    background: "var(--cb-sheet)",
    color: "var(--cb-sheet-ink)",
    /* A column, so the sheet can take up the slack and run to the card's bottom edge however
       few fields the owner mapped. Field count is not a design axis. */
    display: "flex",
    flexDirection: "column",
    /* No height, no max-height, no overflow. Intentional, and load-bearing. */
  };

  return (
    <article
      data-card-root=""
      data-card-variant="page"
      data-template-id={template.id}
      data-palette-id={palette.id}
      /* The template's own legacy axis, published so nothing that reads it has to infer it. */
      data-page-header={template.pageHeader}
      data-finish={surface.finish}
      data-texture={surface.texture}
      data-render-mode="full"
      className={className}
      style={root}
    >
      <CardCover resolved={resolved} surface={surface} palette={palette} />

      <div
        data-card-sheet=""
        /* ⚠ `data-card-body` is kept on this element, and it is not a redundant alias.
           It named "the block below the hero" when the hero was a separate painted region;
           the sheet is that block's successor — the whole paper surface the card is read on —
           and two suites address it by that name. Renaming it would break them to no end.
           `data-card-on-palette` is now `"false"` on both the hero and the body, because in the
           two-tone composition NOTHING stands on the palette except the cover: `card.css` keys
           `::selection` and the caret off this, and both want the sheet's ink. */
        data-card-body=""
        data-card-on-palette="false"
        style={{
          position: "relative",
          /* Above the cover, which is what lets the sheet scroll over a cover that holds
             still — see `card.css` §1c. */
          zIndex: 1,
          background: "var(--cb-sheet)",
          /* ⚠ The card's own bottom corners, taken from the article. The sheet is opaque and
             is the last thing in the card, so without this its square corners would poke out
             through the rounded ones §1b gives the article. `inherit` resolves to 0 in the
             builder's preview and the marketing tiles, where the article has no radius — which
             is correct there, and is why this is inherited rather than a literal. */
          borderBottomLeftRadius: "inherit",
          borderBottomRightRadius: "inherit",
          /* ⚠ **No negative margin, and that is a fix rather than a simplification.**
             The sheet used to be pulled up by the wave's height so the curve would overlap the
             photograph. It does not work: this element paints `--cb-sheet` across its WHOLE
             box, so the strip the wave was drawn into was already opaque paper, and the
             transparent half of the curve revealed the sheet's own background rather than the
             cover. The photograph ended on a straight edge with a decorative squiggle beneath
             it — which is exactly what the first screenshots showed.
             The sheet now starts where the cover ends, and `<SheetCurve>` hangs ABOVE it as an
             out-of-flow layer. The paper the wave is drawn in is the only paper in that strip,
             so the photograph's visible edge IS the curve. */
          /* The flexible track: it takes any room the frame has spare. */
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          paddingInline: "var(--space-6)",
          /* ⚠ The fallback was `var(--space-10)` (40px), a shared scale step nothing else in
             this file reads — it was never chosen for the card, it was just what the token
             scale had nearest to hand. `SPACE.bodyPadBottom` is the same kind of measured
             number as everything else in {@link SPACE}. `--cb-card-body-pad-bottom` itself is
             unchanged and still wins when a consumer sets it — nothing does today. */
          paddingBottom: `var(--cb-card-body-pad-bottom, ${SPACE.bodyPadBottom}px)`,
        }}
      >
        <SheetCurve />

        <div
          style={{
            width: "100%",
            maxWidth: "var(--page-measure)",
            marginInline: "auto",
            display: "flex",
            flexDirection: "column",
            /* ⚠ **`position: relative` is what puts the badge ON the curve instead of under it,
               and its absence was a real bug rather than a near miss.**

               `<SheetCurve>` is `position: absolute`. In CSS painting order every positioned
               element — `z-index: auto` included — paints above non-positioned in-flow content,
               so the wave's paper fill was drawn OVER the badge that is supposed to straddle it.
               The badge's upper arc was erased on every card, and a monogram badge, whose whole
               content sits in that region, rendered as an empty circle. It looked like a
               clipping or crop bug and was neither; `elementsFromPoint` at the badge's centre
               returned the curve's `path` first, which is what identified it.

               Making this column positioned puts it after the SVG in paint order — they are
               siblings in one stacking context and this one comes later in the DOM. `z-index`
               is stated as well so the relationship survives anyone adding a stacking context
               above. */
            position: "relative",
            zIndex: 1,
            /* Nothing to reserve: the curve is out of flow above this column. The badge's own
               negative margin is what lifts it onto the crest. */
            minWidth: 0,
          }}
        >
          {/* ⚠ `resolved.headline`, not `hero.role`. The resolver has already preferred the
              card's own typed position over the first mapped JOB_TITLE; `hero.role` is only the
              field, and reading it here would ignore what the owner typed in the builder.
              `splitHeroFields` still consumes the JOB_TITLE either way, so a card with a typed
              headline does not also list its profile title as a row. */}
          <IdentityBlock resolved={resolved} bio={bio} org={hero.org} role={resolved.headline} />

          {/* Rendered bare. The actions component supplies its own `[data-card-actions]`
              container and its own count: whether there are two controls, one, or none depends
              on the card's data, and only that component knows. */}
          {actions === undefined ? null : (
            <div style={{ marginTop: `${SPACE.heroToAction}px` }}>{actions}</div>
          )}

          <FieldSections sections={sections} count={rowCount} />

          <SocialStrip fields={resolved.socialFields} resolved={resolved} />

          {!showCredit ? null : <MadeWithCredit />}
        </div>
      </div>
    </article>
  );
}

/* ── the cover ──────────────────────────────────────────────────────────────── */

/**
 * The photographic zone — or, when there is no photograph, the palette itself.
 *
 * ## ⚠ `position: sticky`, and why it is safe here when `fixed` was not
 *
 * The cover holds still and the sheet scrolls over it, which is the one authored moment in the
 * page's motion: the curve travels up across the image like a card being drawn out of a wallet.
 *
 * The ground used to be `position: fixed` to get an effect in this family, and §1 of `card.css`
 * records why that was deleted — a fixed layer resolves `inset` against the initial containing
 * block, so it can be neither inset nor rounded, and it escapes the two consumers that are
 * scrolled frames (the builder's preview, the marketing cards).
 *
 * `sticky` has neither problem. It sticks within its nearest scrolling ancestor, which is the
 * document on `/c/{slug}` and the preview frame inside the builder — so the effect is correct
 * in both rather than correct in one and broken in the other. And because the cover is a normal
 * in-flow child, it is inset and rounded by the card like everything else.
 *
 * ⚠ `overflow: hidden` here is on the sticky element ITSELF, not on an ancestor of it. An
 * ancestor with `overflow` would become the scroll container and the stickiness would never
 * activate; on the element it only clips the photograph to the card's top corners, which is
 * what it is for.
 */
function CardCover({
  resolved,
  surface,
  palette,
}: {
  resolved: ResolvedCard;
  surface: CardPageSurface;
  palette: ResolvedCard["palette"];
}): ReactElement {
  const photo = resolved.cover.kind === "photo" ? resolved.cover : null;

  return (
    <div
      data-card-cover=""
      data-cover={resolved.cover.kind}
      style={{
        /* ⚠ **`relative`, not `sticky` — see §1c of `card.css` for the full reason.**
           The cover used to be pinned while the sheet scrolled up over it. The sheet is opaque
           and sits above the cover, so what that actually produced was a photograph being eaten
           by the content — which reads as the image failing to load, not as parallax. The card
           scrolls as one object now. `relative` rather than `static` because the photograph and
           its scrim are absolutely positioned inside this box. */
        position: "relative",
        zIndex: 0,
        width: "100%",
        aspectRatio: `1 / ${surface.coverRatio}`,
        overflow: "hidden",
        /* The card's own corners, inherited rather than restated — one number, in `card.css`. */
        borderTopLeftRadius: "inherit",
        borderTopRightRadius: "inherit",
      }}
    >
      {/* The palette, painted. ⚠ `texture="none"` on every card: the motif axis is switched OFF
          for this composition while it is evaluated without one. The owner's `texture`,
          `texturePresence` and `textureScale` are still resolved, still persisted and still
          round-trip through the API untouched — turning the motif back on is passing
          `surface.texture` here instead of the literal, and nothing else. A grid or a dot
          screen laid over a photograph of somebody's face is noise rather than texture, which
          is the specific thing being avoided. */}
      <CardGround
        palette={palette}
        finish={surface.finish}
        texture="none"
        texturePresence={surface.texturePresence}
        textureScale={surface.textureScale}
      />

      {photo === null ? null : (
        <>
          {/* A plain img element rather than next/image: see the note in `share-face.tsx` —
              next/image's markup does not survive html-to-image serialisation, and this card is
              exported to PNG. (Written without the literal tag in the prose: `impeccable`'s
              broken-image rule is a text regex and reads an angle-bracketed tag in a comment as
              a real one with no `src`.) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-card-cover-photo=""
            src={photo.url}
            alt={photo.alt}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              /* ⚠ Above centre, deliberately. An uploaded portrait puts the face in the upper
                 third and a centred crop takes the chin off it. There is no crop UI, so the
                 default has to be the one that is right for the photographs people actually
                 upload rather than the one that is geometrically neutral. */
              objectPosition: "50% 28%",
              display: "block",
            }}
          />
          {/* The scrim. It exists for the curve and the badge, not for the photograph: both are
              drawn in sheet colour and both need the bottom of an arbitrary image to be darker
              than they are, or a photograph with a pale lower edge swallows the wave. Confined
              to the bottom third so it never touches the face. */}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              insetInline: 0,
              bottom: 0,
              height: "38%",
              background:
                "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--c-ground) 55%, transparent))",
              pointerEvents: "none",
            }}
          />
        </>
      )}
    </div>
  );
}

/* ── the curve ──────────────────────────────────────────────────────────────── */

/**
 * The wave the sheet rises over — the design's signature, and one path.
 *
 * ## Why one stretched path rather than geometry computed per width
 *
 * `preserveAspectRatio="none"` stretches the viewBox to the element's box, which distorts.
 * That is acceptable here and nowhere else in the product, because of how narrow the range is:
 * the card is 336px wide inside the builder's frame and 508px at its widest, so the horizontal
 * scale runs 0.84–1.27 against a fixed 44px height. The curve flattens very slightly on a
 * desktop and steepens very slightly on a phone, which is what a hand-drawn wave would do
 * anyway. Generating a path per measured width would need the width, and measuring it would
 * need client state on a component that is otherwise renderable on the server.
 *
 * ## ⚠ THE ACCENT HAIRLINE ALONG THIS EDGE IS GONE — 2026-09-21, AND IT WAS READ AS A GLITCH
 *
 * The curve used to be traced by a second, unclosed copy of the path stroked in
 * `--cb-accent-line` at `vector-effect="non-scaling-stroke"`, so the hairline stayed exactly
 * one pixel under the stretch above. Reported by the client on their own card, twice, as a
 * defect rather than a detail: *"why is this line appearing beside the logo when I am zooming
 * out the page… this is an actual glitch."* They were reading it correctly, and the reason is
 * geometry rather than taste:
 *
 *   · **The path leaves both edges almost flat.** It opens `M0 34 C 62 34, …` — the first
 *     control point shares the start point's `y`, so the curve exits `x=0` exactly horizontally
 *     and holds within a fraction of `y=34` for the first ~15% of the width. The right shoulder
 *     is shallow for the same reason.
 *   · **`preserveAspectRatio="none"` flattens it further.** 52 viewBox units are squashed into
 *     `CURVE_H` px vertically while 400 are stretched across 336–508px horizontally, so the
 *     shoulders arrive at the card's edges flatter still.
 *   · **`non-scaling-stroke` then refuses to let it soften.** Every other edge in that strip is
 *     a photograph meeting paper, which antialiases and fades as the card scales down; a
 *     non-scaling stroke holds a constant 1px. At the zoom levels where it lands on a device
 *     pixel row it renders crisp and flat while everything around it has gone fine — which is
 *     exactly the "it appears when I zoom out" the report describes, and why it reads as a rule
 *     someone left in rather than as the edge of a wave.
 *
 * Nothing replaces it, because nothing has to: the scrim inside {@link CardCover} already
 * exists for this precise job — its own comment says it is there "for the curve and the badge,
 * not for the photograph", darkening the image's bottom third so "a photograph with a pale
 * lower edge" cannot swallow the wave. The curve's visible edge is now the photograph meeting
 * the paper and nothing else, which is a real contrast edge that scales with the card.
 *
 * If a future cover ever does need the edge drawn, do NOT restore a uniform stroke — fade it
 * out towards both shoulders so only the region that is actually curved is hairlined.
 *
 * `--cb-accent-line` itself is untouched and still draws the section dividers below, where a
 * dead-straight 1px rule is exactly what is wanted.
 *
 * ## The shape is asymmetric on purpose
 *
 * A symmetric arc reads as a progress bar or a tab. The low point sits left of centre and the
 * right shoulder rises higher, which is what makes it read as drawn rather than as a shape
 * primitive — and it is why the badge is centred on the curve's own low region rather than on
 * the card's horizontal centre line.
 */
function SheetCurve(): ReactElement {
  /* ⚠ ONE swell, it CRESTS under the badge, and it has two inflections at most.
     The first version had three inflections and dipped in the middle — at 52px over 400 wide
     three inflections read as a wobble rather than a wave, and a dip put the badge in a trough
     with two-thirds of it hanging over the photograph. The sheet rising to MEET the badge is
     what makes the mark part of the card instead of stuck on it.

     The crest sits at y=7 — CREST_Y, which the badge's offset is derived from — slightly left
     of centre at x=190, and the right shoulder falls further than the left one rises. That
     asymmetry is what stops it reading as an arch or a tab.

     Fills downward from the wave to the bottom of the strip, so the region ABOVE it stays
     transparent and the cover shows through. */
  const wave = "M0 34 C 62 34, 112 8, 190 7 C 278 6, 332 21, 400 29 L400 52 L0 52 Z";

  return (
    <svg
      data-card-curve=""
      viewBox="0 0 400 52"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      style={{
        position: "absolute",
        insetInline: 0,
        /* ⚠ ABOVE the sheet's top edge, overlapping the cover's last `CURVE_H` pixels. The
           sheet is opaque from its own top down, so the wave has to be drawn outside it — see
           the ⚠ on the sheet's `marginTop` for the defect this arrangement fixes. */
        top: `-${CURVE_H}px`,
        width: "100%",
        height: `${CURVE_H}px`,
        display: "block",
      }}
    >
      {/* ⚠ ONE PATH, FILL ONLY, NO STROKE. See this function's own header for the second path
          that used to trace this edge and why it was removed rather than retuned. */}
      <path d={wave} fill="var(--cb-sheet)" />
    </svg>
  );
}

/* ── the identity block ─────────────────────────────────────────────────────── */

/**
 * Badge, company, name, role, bio — in that order, centred, and none of it conditional on
 * anything but whether the owner supplied it.
 *
 * ⚠ The company is the WORDMARK above the name and is not repeated beneath it. The reference
 * prints it in both places; on a card with real data that reads as the card repeating itself
 * two inches apart. `splitHeroFields` has already removed it from the stack below, so this is
 * the only place it appears at all.
 */
function IdentityBlock({
  resolved,
  bio,
  org,
  role,
}: {
  resolved: ResolvedCard;
  bio: string | null;
  org: string | null;
  role: string | null;
}): ReactElement {
  return (
    <header
      data-card-hero=""
      data-card-on-palette="false"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        /* ⚠ Zero, and load-bearing. Every space in this block is a margin on the element below
           it — see {@link SPACE}. A `gap` here would silently add to all of them. */
        gap: 0,
        minWidth: 0,
      }}
    >
      <CardBadge resolved={resolved} />

      {org === null ? null : (
        <p
          data-card-brand=""
          style={{
            margin: `${SPACE.badgeToBrand}px 0 0`,
            fontSize: "var(--text-overline)",
            lineHeight: "var(--text-overline-lh)",
            /* Wider than the token's 0.08em. A five-character company reads as a mark at this
               tracking and as a word at the token's; the mark is what sits under a badge. */
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: "var(--weight-medium)",
            /* A word, so the 4.5:1 accent and never the 3:1 mark accent. */
            color: "var(--cb-accent-text)",
            overflowWrap: "anywhere",
          }}
        >
          {org}
        </p>
      )}

      <h1
        data-card-name=""
        style={{
          /* ⚠ The one place the display serif is used, with the sans as its fallback rather
             than a generic serif: if `--font-serif` fails to load, a name set in Times beside a
             page of Geist looks like a bug, and a name set in Geist looks like a decision. */
          fontFamily: "var(--font-serif), var(--font-sans)",
          fontSize: NAME_SIZE,
          fontWeight: 400,
          letterSpacing: "-0.018em",
          lineHeight: 1.1,
          color: "var(--cb-sheet-ink)",
          /* ⚠ The wordmark collapses when the owner maps no company, and then this margin is the
             badge's. Both readings want the same small number, so there is nothing to branch. */
          margin: `${SPACE.brandToName}px 0 0`,
          /* A two-line name breaks evenly instead of leaving one word alone on the second line.
             Purely typographic — `balance` cannot change where the box ends. */
          textWrap: "balance",
          /* The one thing that stops a long surname in a 288px column producing a sideways
             scrollbar. E-15 and E-53 both measure it. */
          overflowWrap: "anywhere",
        }}
      >
        {resolved.fullName}
      </h1>

      {role === null ? null : (
        <p
          data-card-role=""
          style={{
            margin: `${SPACE.nameToRole}px 0 0`,
            fontSize: "var(--text-base)",
            color: "var(--cb-sheet-ink-soft)",
            overflowWrap: "anywhere",
          }}
        >
          {role}
        </p>
      )}

      {bio === null ? null : (
        <p
          data-card-bio=""
          style={{
            fontFamily: "var(--font-serif), var(--font-sans)",
            fontSize: "var(--text-lg)",
            lineHeight: 1.42,
            color: "var(--cb-sheet-ink-soft)",
            /* ⚠ **The reported gap.** It was `--space-3` on top of the column's 8px `gap`, so
               the real distance was 20 and nothing on screen explained why. */
            margin: `${SPACE.roleToBio}px 0 0`,
            maxWidth: "32ch",
            textWrap: "pretty",
            overflowWrap: "anywhere",
          }}
        >
          {bio}
        </p>
      )}
    </header>
  );
}

/**
 * The badge that straddles the curve — the card's logo, else the owner's initials.
 *
 * The ring is `--cb-sheet` and not a colour: it is the sheet's own paper, drawn around the
 * badge so the badge reads as **cut into** the curve rather than pasted on top of it. A tinted
 * ring would be a third object in a hero composed for two.
 *
 * `[data-card-portrait]` is kept on this element, which is the card page's mark slot now. The
 * builder's suite reads that attribute to check a card wears the logo it was given, and the
 * question it is asking has not changed.
 */
function CardBadge({ resolved }: { resolved: ResolvedCard }): ReactElement {
  const base: CSSProperties = {
    width: `${BADGE}px`,
    height: `${BADGE}px`,
    borderRadius: "var(--radius-full)",
    overflow: "hidden",
    flexShrink: 0,
    /* The badge's TOP edge lands on the crest, so the disc sits on paper and only its upper arc
       crosses into the photograph. The crest is `CURVE_H - CREST_Y` above the sheet's top edge,
       and this column starts at that edge — so one expression, derived from the path's own
       numbers rather than tuned by eye against a screenshot. */
    marginTop: `calc(-1 * ${CURVE_H - CREST_Y}px)`,
    /* ⚠ **The fill is PAPER, and that is a fix rather than a preference.**
       It was `--cb-accent-wash` — the accent at 9% — which is a light grey. A light grey disc
       reads as white against the photograph above the curve and as grey against the sheet
       below it, so the one badge looked like two stacked shapes with a seam on the curve. A
       disc filled with the sheet's own paper reads as a single object cut into the curve from
       either side, which is what the reference's badge is. */
    background: "var(--cb-sheet)",
    /* ⚠ The edge has to survive the badge's own CONTENT, which we do not control.
       A logo with a pale background sits on paper of almost the same value, and at an 18%
       hairline the disc simply disappeared into the sheet — the upper half of the badge read as
       missing. So: a 3px paper ring to lift it off a dark photograph, then a 30% accent ring
       that is visible against paper, then a soft drop shadow so it reads as an object on the
       card rather than a hole in it. Three layers because the badge crosses two very different
       surfaces and has to hold its shape on both. */
    boxShadow: [
      "0 0 0 3px var(--cb-sheet)",
      "0 0 0 4px color-mix(in srgb, var(--cb-accent) 30%, transparent)",
      "0 10px 22px -10px color-mix(in srgb, var(--cb-accent) 45%, transparent)",
    ].join(", "),
    display: "block",
  };

  if (resolved.badge.kind === "logo") {
    return (
      <span data-card-badge="" data-card-portrait="logo" style={base}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolved.badge.url}
          alt={resolved.badge.alt}
          width={BADGE}
          height={BADGE}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </span>
    );
  }

  return (
    <span
      data-card-badge=""
      data-card-portrait="monogram"
      aria-hidden="true"
      style={{
        ...base,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        /* Initials are read as text. */
        color: "var(--cb-accent-text)",
        fontFamily: "var(--font-serif), var(--font-sans)",
        fontSize: `${Math.round(BADGE * 0.36)}px`,
        fontWeight: 400,
        lineHeight: 1,
        letterSpacing: "0.02em",
      }}
    >
      {resolved.badge.initials}
    </span>
  );
}

/* ── the stack ──────────────────────────────────────────────────────────────── */

/**
 * Every field the owner mapped, in headed sections, with nothing clipped and nothing scrolled.
 *
 * ## The heading rule
 *
 * Headings appear only when there are **two or more** sections. A card whose every field lands
 * in one category — the commonest shape for a minimal personal card — gets its rows and no
 * label, because a lone "PERSONAL" above three rows is bureaucracy rather than structure.
 *
 * ## `data-card-fields` moved out one level
 *
 * It used to be the `<ul>`. It is now the wrapper, because there is one `<ul>` per section and
 * `data-field-count` has to mean the whole card. Rows are `[data-card-fields] li`; `card.css`
 * §2 matches that. The count is still the number of rows PAINTED and never
 * `resolved.fields.length` — declaring more than is drawn is the old build's "5 fields / 4
 * rows" defect restated as an off-by-one.
 */
function FieldSections({
  sections,
  count,
}: {
  sections: readonly CardPageSection[];
  count: number;
}): ReactElement | null {
  /* Not an empty list: a zero-field card renders as identity plus actions and nothing else. */
  if (sections.length === 0) return null;

  const headed = sections.length > 1;
  /* The stagger continues from the actions above, which hold indices 0 and 1. */
  let rise = 2;

  return (
    <div
      data-card-fields=""
      data-field-count={count}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: `${SPACE.sectionGap}px`,
        marginTop: `${SPACE.actionToStack}px`,
        /* ⚠ A rule under the primary action, which the reference has and this build did not.
           Without it the first section's label floats directly beneath the button and reads as
           the button's own caption rather than as the head of a list. */
        borderTop: "1px solid var(--cb-accent-line)",
        paddingTop: `${SPACE.actionToStack}px`,
      }}
    >
      {sections.map((section, index) => (
        <section
          key={section.category}
          data-card-section={section.category}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
            /* A rule between sections and never above the first: the first section's separator
               is the space under the primary action, which is already doing that work. */
            borderTop: index === 0 ? undefined : "1px solid var(--cb-accent-line)",
            paddingTop: index === 0 ? undefined : `${SPACE.sectionGap}px`,
          }}
        >
          {!headed ? null : (
            <h2
              data-card-section-label=""
              style={{
                margin: `0 0 ${SPACE.labelToRows}px`,
                paddingInline: "var(--space-2)",
                fontSize: "var(--text-overline)",
                lineHeight: "var(--text-overline-lh)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: "var(--weight-medium)",
                color: "var(--cb-sheet-ink-soft)",
              }}
            >
              {section.label}
            </h2>
          )}

          {/* A real list: this is a list of destinations, and a screen reader announcing
              "list, 5 items" before the first is the difference between a stack a blind reader
              can navigate and one they have to walk blindly. `role="list"` is stated because
              Safari drops the implicit role the moment `list-style: none` is applied. */}
          <ul
            role="list"
            style={{ display: "flex", flexDirection: "column", listStyle: "none", margin: 0, padding: 0 }}
          >
            {section.rows.map((entry) => (
              <li
                key={entry.field.id}
                data-card-field-row=""
                data-card-field={entry.field.id}
                data-card-row-kind={entry.kind}
                {...(entry.kind === "masked" ? { "data-card-field-masked": "" } : {})}
                /* THE STACK RISES — this row's place in the one authored moment. `card.css`
                   multiplies by 40ms and caps the result; the whole animation lives inside
                   `prefers-reduced-motion: no-preference`. It is a number and never a style:
                   the row's painted state is its default, and the keyframe only says where it
                   came from. */
                style={{ minWidth: 0, ["--cb-rise-index" as string]: rise++ } as CSSProperties}
              >
                {entry.kind === "action" ? <ActionRow entry={entry} /> : <NoteRow entry={entry} />}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Whitespace- and case-insensitive equality, for deciding whether a line repeats another. */
function sameText(a: string, b: string): boolean {
  const key = (v: string): string => v.trim().replace(/\s+/g, " ").toLowerCase();
  return key(a) === key(b);
}

/**
 * The disc every row icon sits in. One definition, so a note and an action cannot drift.
 *
 * @param nudge lifts the disc onto the FIRST line of a multi-line row. A single-line row centres
 *   the two against each other with `align-items`, which is right there and wrong the moment the
 *   text wraps: the disc then floats against the middle of a three-line paragraph, level with
 *   nothing. The offset is `(line - disc) / 2` — negative, because the disc is taller than a line
 *   of text — so the two are centred on each other rather than on the block.
 */
function RowDisc({
  children,
  muted,
  nudge = false,
}: {
  children: ReactNode;
  muted?: boolean;
  nudge?: boolean;
}): ReactElement {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: nudge ? `${Math.round((ROW_LINE - ROW_DISC) / 2)}px` : undefined,
        width: `${ROW_DISC}px`,
        height: `${ROW_DISC}px`,
        borderRadius: "var(--radius-full)",
        background: "var(--cb-accent-wash)",
        color: muted === true ? "var(--cb-sheet-ink-soft)" : "var(--cb-accent)",
      }}
    >
      {children}
    </span>
  );
}

/**
 * An actionable field: the value, and a chevron saying it goes somewhere.
 *
 * ## The two arrows mean different things
 *
 * An outbound arrow for a destination that leaves the app, a chevron for one that stays with
 * the phone — a dialler, a mail client, a map. That distinction was already drawn when the row
 * printed only its label and it is worth more now: a reader deciding whether to tap a link
 * wants to know whether they are about to lose the card.
 *
 * ## The value is printed, the label is spoken
 *
 * See the module note for why printing `row.display` is safe. `actionAccessibleName` puts
 * `"Work email: maya@…"` in the accessible name, which is what tells a screen-reader user
 * WHICH of three addresses this row is — the job the printed label used to do.
 *
 * It is `aria-label` rather than visually hidden text on purpose: hidden text lands in
 * `innerText`, and the coordinate assertion in `tests/e2e/public-card.spec.ts` reads
 * `body.innerText()`.
 */
function ActionRow({ entry }: { entry: CardPageRow }): ReactElement {
  const { row } = entry;
  /* Narrowed by the classifier — an `action` row has an href by definition. The fallback is
     unreachable and exists only so this component needs no non-null assertion. */
  const href = row.href ?? "#";
  /* Only `ADDRESS` produces more than one line today; the rule keys off the count so anything
     that starts to inherits the right alignment without this file knowing about it. */
  const multiline = row.lines.length > 1;

  return (
    <a
      data-card-action-button={entry.field.id}
      data-card-row-surface="sheet"
      href={href}
      /* AC-32: a destination that leaves the app never gets an opener handle on this tab. */
      {...(row.external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
      aria-label={actionAccessibleName(row)}
      style={{
        display: "flex",
        /* Centred on one line, top-aligned when the value wraps — see {@link RowDisc}. */
        alignItems: multiline ? "flex-start" : "center",
        gap: "var(--space-3)",
        width: "100%",
        minHeight: `${ROW_MIN_HEIGHT}px`,
        /* ⚠ 4px, not 8. `minHeight` alone does not set the pitch — the padding does, the moment
           the content is tall enough to exceed the floor, and at 8 every row measured about 52
           rather than the 44 the floor was lowered to. The reference's rows sit at roughly 30pt;
           44 is as close as a real tap target gets, so nothing is allowed to add to it. */
        paddingBlock: "var(--space-1)",
        paddingInline: "var(--space-2)",
        borderRadius: "var(--radius-md)",
        color: "var(--cb-sheet-ink)",
        textDecoration: "none",
        fontSize: "var(--text-base)",
        letterSpacing: "0.002em",
        cursor: "pointer",
      }}
    >
      <RowDisc nudge={multiline}>{row.icon}</RowDisc>

      {/* ⚠ **A single-line value ELLIPSES; a multi-line one wraps.**
          `overflowWrap: "anywhere"` was applied to both, and on a 390px phone it broke
          `priyanka.r@mailbox.example` across two lines mid-token — "…mailbox.exam / ple" — which
          destroys the row rhythm the whole tightening pass was for and reads as a rendering bug.
          Nothing is lost by clipping instead: the full value is in `title` and in the button's
          accessible name, and the destination is the same either way.
          An ADDRESS is the case that genuinely needs the second line — `row.lines` carries two
          for it and only for it — so the rule keys off the line count rather than off the field
          type, and a renderer that starts emitting two lines for something else inherits the
          right behaviour without this file knowing about it. */}
      <span
        data-field-value=""
        data-card-field-value=""
        title={row.title}
        style={{ flex: 1, minWidth: 0 }}
      >
        {row.lines.map((line, i) => (
          <span
            key={i}
            style={
              row.lines.length > 1
                ? { display: "block", overflowWrap: "anywhere" }
                : {
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }
            }
          >
            {line}
          </span>
        ))}
      </span>

      <span
        aria-hidden="true"
        style={{
          display: "flex",
          flexShrink: 0,
          width: "16px",
          justifyContent: "center",
          color: "var(--cb-sheet-ink-soft)",
        }}
      >
        {row.external ? <ArrowUpRight size={16} strokeWidth={1.6} /> : <ChevronRight size={16} strokeWidth={1.6} />}
      </span>
    </a>
  );
}

/**
 * A descriptive or masked field: the same row, without a chevron and without a tap.
 *
 * These are the rows with nowhere to go — a date, an availability status, a live-location chip,
 * a second company — plus every masked row, which has a value and is forbidden a destination
 * (§7.3, AC-33).
 *
 * ## ⚠ A masked row keeps its label. An actionable one does not
 *
 * Everywhere else on this page the value stands alone, because an address or a phone number
 * says what it is. `•••• 4321` does not: without "HSBC current account" in front of it, a
 * masked row is a string of dots the reader cannot even identify, let alone use. So the label
 * comes back for exactly this case, as an overline above the value.
 *
 * The chevron is absent rather than disabled. A control the reader presses and nothing happens
 * teaches them that none of the other eight work either.
 */
function NoteRow({ entry }: { entry: CardPageRow }): ReactElement {
  const { row } = entry;
  const labelled = entry.kind === "masked";
  /* ⚠ A note's text WRAPS — it is the content, not a handle on a destination — so a long one is
     multi-line even at `lines.length === 1`. `stacked` therefore covers both: a labelled row,
     which is two lines by construction, and a long single-line value that will wrap. */
  const stacked = labelled || row.display.length > 34;

  return (
    <div
      data-card-note={entry.field.id}
      data-card-row-surface="sheet"
      style={{
        display: "flex",
        alignItems: stacked ? "flex-start" : "center",
        gap: "var(--space-3)",
        minHeight: `${ROW_MIN_HEIGHT}px`,
        /* Matched to the action row above, so a note and a button keep one rhythm. */
        paddingBlock: "var(--space-1)",
        paddingInline: "var(--space-2)",
        minWidth: 0,
      }}
    >
      <RowDisc muted nudge={stacked}>{row.icon}</RowDisc>

      <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 }}>
        {!labelled ? null : (
          <span
            style={{
              fontSize: "var(--text-overline)",
              lineHeight: "var(--text-overline-lh)",
              letterSpacing: "var(--text-overline-tracking)",
              textTransform: "uppercase",
              color: "var(--cb-sheet-ink-soft)",
            }}
          >
            {row.label}
          </span>
        )}

        {/* Both attributes on purpose: `data-field-value` is what `globals.css` targets for
            `overflow-wrap`, and `data-card-field-value` is the stable hook tests use — AC-33
            reads the masked string through it. `title` is `row.title`, which the renderer has
            already replaced with the MASKED string on a masked row; a title is readable on
            hover and on copy, so a masked row carrying the raw one would be masked in
            appearance only. */}
        <span
          data-field-value=""
          data-card-field-value=""
          title={row.title}
          style={{
            color: "var(--cb-sheet-ink)",
            fontSize: "var(--text-base)",
            display: "block",
            minWidth: 0,
          }}
        >
          {/* ⚠ **A note always WRAPS. Only an action row clips.**
              The two are the same shape and opposite cases. An action row's value is a handle on
              a destination — the tap is what matters, the string is identification — so clipping
              a long address costs nothing and keeping the row on one line is worth a lot. A note
              has nowhere to go: the text IS the content, and there is no tap, no tooltip on a
              phone and no other way to read the rest. Truncating one is just deleting it.
              `break-word` and not `anywhere`: it breaks only a word that cannot fit on a line of
              its own, so prose wraps at spaces like prose and a 60-character token still does not
              force a sideways scroll (E-15). */}
          {row.lines.map((line, i) => (
            <span key={i} style={{ display: "block", overflowWrap: "break-word" }}>
              {line}
            </span>
          ))}
        </span>

        {/* ⚠ Dropped when it repeats the label. `DIGITAL_WALLET` sets `context` to the provider
            and owners name the field after the provider too, so a masked wallet printed
            "PAYPAL / ••••pays / PayPal" — three lines, two of which are the same word. The
            context earns its line only when it says something the label did not. */}
        {row.context === null || !labelled || sameText(row.context, row.label) ? null : (
          <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--cb-sheet-ink-soft)" }}>
            {row.context}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── the social strip ───────────────────────────────────────────────────────── */

/**
 * Every social link the owner mapped, as a wrapping row of discs.
 *
 * ## Why these leave the stack entirely
 *
 * A social link is the one field type whose *platform* is more informative than its value:
 * `@maya` tells a reader nothing, and the LinkedIn mark tells them everything. Rendered as
 * stack rows they were six near-identical lines; rendered as marks they are the part of the
 * card a reader recognises fastest.
 *
 * ⚠ **They are removed from the stack by `cardPageSections`, not by this component.** One
 * answer to "stack or strip", in the module that already classifies rows, so the two cannot
 * both claim a field or both drop it.
 *
 * ## Unbounded, and it wraps
 *
 * There is no cap. The owner adds as many as they like in their profile and every one appears;
 * the row centres and wraps, so eleven links read as a tidy block rather than a scroller. A
 * platform we do not recognise keeps the generic mark and still gets a disc — never a hole
 * (E-23).
 *
 * ## It is not in the `.vcf`'s way
 *
 * `buildVcf` writes `[...resolved.fields, ...resolved.socialFields]` and is untouched by this:
 * the strip is a different presentation of the same array, not a different array.
 */
function SocialStrip({
  fields,
  resolved,
}: {
  fields: readonly ResolvedField[];
  resolved: ResolvedCard;
}): ReactElement | null {
  const links = fields
    .map((field) => {
      const row = renderFieldRow(field, { iconSize: ROW_ICON_SIZE });
      /* Declined by the registry, blank (E-07), or a URL the scheme check refused (§7.4) — a
         social link with no safe destination is not a disc the reader can press. */
      if (row === null || row.href === null) return null;
      return { key: field.id, href: row.href, platform: parseSocialLink(field.value).platform };
    })
    .filter((link): link is NonNullable<typeof link> => link !== null);

  /**
   * ⚠ **WhatsApp joins the strip, and that is where the second big button went.**
   *
   * It was a full-width outline button under the primary one: two stacked controls costing
   * about 110px before a single field appeared, on the surface with the least vertical room in
   * the product. The reference has exactly one button, and everything else "channelized below"
   * — so the messaging action becomes what it actually is, one destination among the others.
   *
   * It is derived rather than mapped: `whatsappActionFor` reads the card's first `PHONE`, so the
   * disc appears whenever the owner shares a number and disappears when they do not (E-56), with
   * nothing for them to configure. The glyph already exists — WhatsApp is one of the fourteen
   * hosts `SOCIAL_PLATFORMS` names — so this costs no new art.
   *
   * ⚠ It is appended rather than prepended: the owner's own social links are theirs and come
   * first. A derived action inserting itself ahead of them would reorder the strip on a card
   * whose owner never asked for it.
   */
  const whatsapp = whatsappActionFor(resolved);
  const discs =
    whatsapp === null
      ? links
      : [...links, { key: "whatsapp", href: whatsapp.href, platform: "WhatsApp" }];

  if (discs.length === 0) return null;

  return (
    <section
      data-card-socials=""
      data-social-count={discs.length}
      /* ⚠ **Inline — the label sits BESIDE the discs, not above them.**
         A centred heading over a centred row cost two lines and a gap for four icons, at the
         very bottom of the card where the reader has already scrolled furthest. The reference
         puts "SOCIAL" at the left and the discs beside it, which is one line and reads as the
         same kind of thing as the section labels above it. It still wraps: the discs are a
         flex row of their own, so eleven of them stack under each other rather than pushing
         the label off the card. */
      style={{
        display: "flex",
        /* ⚠ **`flex-start`, not `center`.** Centred, a label beside a WRAPPED row of discs floats
           between the two rows with nothing to align to — which is exactly how six discs looked
           the first time this shipped. Aligned to the top, the label sits level with the first
           row and a wrap reads as a deliberate block of marks beside a heading. */
        alignItems: "flex-start",
        gap: "var(--space-3)",
        flexWrap: "wrap",
        marginTop: `${SPACE.stackToSocial}px`,
        paddingTop: `${SPACE.stackToSocial}px`,
        borderTop: "1px solid var(--cb-accent-line)",
      }}
    >
      <h2
        style={{
          margin: 0,
          flexShrink: 0,
          /* Optically level with the first row of discs rather than with the top of its own box:
             the label is 11px type and the disc is 36px, so the two do not centre on each other
             by sitting on the same line. */
          paddingTop: "10px",
          paddingInline: "var(--space-2)",
          fontSize: "var(--text-overline)",
          lineHeight: "var(--text-overline-lh)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: "var(--weight-medium)",
          color: "var(--cb-sheet-ink-soft)",
        }}
      >
        Social
      </h2>

      <ul
        role="list"
        style={{
          display: "flex",
          flexWrap: "wrap",
          /* ⚠ **Left-packed, not centred.** Centred, a wrapped sixth disc lands alone in the
             middle of its own line and reads as a mistake. Packed left it continues the block,
             so the strip degrades into a tidy grid of marks beside the label instead of an
             orphan. Five discs — the reference's four plus the derived WhatsApp — fit one line
             at every width this card is read at; six is where it wraps. */
          justifyContent: "flex-start",
          alignItems: "center",
          flex: 1,
          minWidth: 0,
          /* ⚠ 6px, measured rather than chosen. At 390px the list box is 240.7px wide and six
             34px discs with 8px gaps need 244 — short by three pixels, which is what kept
             orphaning WhatsApp onto a second line. Six with 6px gaps need 234 and fit with room.
             The gap gives way rather than the disc because a 34px target with 6px of clear space
             still satisfies 2.5.8 comfortably (40px centre to centre, so 24px targets never
             collide) and a smaller disc would have been paid for in tappability. */
          gap: "6px",
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {discs.map((link) => (
          <li key={link.key} style={{ display: "flex" }}>
            <a
              data-card-social={link.key}
              href={link.href}
              rel="noopener noreferrer"
              target="_blank"
              /* The platform, not the handle: "LinkedIn" is what a screen-reader user needs to
                 decide whether to follow it, and the handle is in the `.vcf` either way. */
              aria-label={`${link.platform}, opens in a new tab`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                /* ⚠ 36, and the number is set by arithmetic rather than by taste.
                   2.5.5's 44px floor has a documented exception for targets carrying at least
                   24px of clear spacing (2.5.8), which these do — their own row, 8px apart,
                   nothing above or below to mis-hit. What decides 36 over 40 is the width: on a
                   390px phone the sheet's content column is 342px, and the label plus its gap
                   takes about 83 of it. Six discs at 40 need 280 and wrap; at 36 they need 256
                   and fit. Six is the realistic upper bound for one line — five mapped socials
                   plus the derived WhatsApp — and past that it wraps, which is now fine.
                   ⚠ The arithmetic above was done against the wrong width the first time: the
                   content column is 318px on a 390px phone, not 342 — the card's own 12px page
                   inset comes off before the sheet's 24px padding does. 34 with a 6px gap is
                   what actually fits six at 390px. Below about 375px it wraps, and that is the
                   intended degradation — left-packed, so it reads as a block of marks beside the
                   label rather than as an orphan. */
                width: "34px",
                height: "34px",
                borderRadius: "var(--radius-full)",
                background: "var(--cb-accent-wash)",
                color: "var(--cb-accent)",
                textDecoration: "none",
              }}
            >
              <span aria-hidden="true" style={{ display: "block", width: "17px", height: "17px" }}>
                {socialGlyph(link.platform)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The one way out of this page, at the foot where §8D.5 puts it.
 *
 * ⚠ Not a link, and not at the top. The wordmark that used to sit above the owner's name now
 * prints the owner's COMPANY; the product's own name lives here, under everything, so a card
 * still travels with its attribution without the product advertising itself louder than the
 * person whose card it is. `tests/e2e/public-card.spec.ts` asserts this page carries no `<nav>`
 * and no app chrome at all.
 *
 * ⚠ Rendered by `CardPage` only when `showCredit` is true, which it is unless a caller states
 * otherwise. Deciding whether to render this at all is the parent's job (see `CardPageProps`),
 * not this component's — it has no opinion of its own, so there is exactly one place that
 * question is answered.
 */
/**
 * ⚠ **THE FOOT IS A LOCKUP NOW — a label and the product's mark, not one grey line.**
 *
 * It was a single 12px sentence, 6px under the social strip and 8px off the card's bottom edge.
 * Reported with that line circled: it read as something left over rather than as the card's
 * ending, and the product's own brand was nowhere on a surface whose whole job is to be handed
 * to a stranger. This is the one unpaid channel back to the product; it should look like it was
 * placed there.
 *
 * So the foot is now three things, centred on one axis and spaced by three named constants:
 *
 *     Made with Contact Book        ← the label. 10px, uppercase, wide-tracked, muted.
 *     ┌──┐
 *     │CB│ CONTACTBOOK              ← the mark, {@link CREDIT_LOGO_WIDTH} wide.
 *     └──┘ NEVER LOSE CONTACT
 *
 * ## ⚠ The label is a CAPTION and the mark is the object, which is why the wording repeats
 *
 * "Contact Book" appears in the label and again in the wordmark, and that is deliberate rather
 * than an oversight. The label is set as an overline — 10px, `0.16em` of tracking, uppercase,
 * `--cb-sheet-ink-soft` at 70% — so it reads as a caption on the mark in the way "POWERED BY"
 * does, not as a second wordmark competing with the first. Setting it at body size, in sentence
 * case, directly above a wordmark of the same words is what would look like a mistake.
 *
 * ## ⚠ `[data-card-credit]` still contains EXACTLY "Made with Contact Book"
 *
 * `tests/e2e/public-card.spec.ts` asserts `toHaveText` on it and `tests/unit/card-variants`
 * asserts `textContent ===`, and both are right to: the attribution has to survive as *text* —
 * in a copy-paste, in a reader mode, to a screen reader, and in any context where the mark does
 * not load. **So the mark is a SIBLING of that element and never a child of it.** Putting it
 * inside would break both suites and, more to the point, would make the attribution depend on
 * an image loading.
 *
 * The mark is therefore `aria-hidden` with an empty `alt`: it is decorative *here*, because the
 * line directly above it already says the same words. A second announcement of "Contact Book
 * logo" would be a screen reader reading the footer twice.
 *
 * ## Why a picture element and not inline vector or the framework's image component
 *
 * The card is exported to PNG through `html-to-image`, and the two rules that come with that
 * are already documented on the cover photograph in `<CardCover>`: the framework's image
 * component does not survive serialisation, and a plain picture element does. (Written without
 * the literal tag in this prose: `impeccable`'s broken-image rule is a text regex and reads an
 * angle-bracketed tag in a comment as a real one with no source.)
 *
 * The asset is a **transparent** PNG, un-matted from the brand lockup, which matters on this
 * surface specifically: `--cb-sheet` is white carrying 3% of the card's palette, so it is
 * faintly warm on a Rust card and faintly cool on a Sapphire one. A logo on a baked-in white
 * ground would show a visible white rectangle on eight of the nine palettes.
 */
function MadeWithCredit(): ReactElement {
  return (
    <div
      data-card-footer=""
      style={{
        marginTop: `${SPACE.socialToCredit}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: `${SPACE.creditToLogo}px`,
      }}
    >
      {/* ⚠ **Smaller than `--text-overline` on purpose, and it is the one place in the card
          that goes below the scale.** At 11px, uppercase and wide-tracked, this line measured
          about 175px against the mark's 156 — the caption wider and heavier than the object it
          captions, which is the hierarchy backwards, and which is what made the repeated words
          read as the same name printed twice. At 9px it measures ~148 and sits inside the
          mark's width, where it reads as a label on it.

          ⚠ **`opacity` is 0.8 and must not go lower.** `--cb-sheet-ink-soft` is `--ink-2`, and
          the blend against the sheet is what a reader actually sees: 0.8 measures 6.0:1, 0.75
          measures 5.2:1, and **0.6 — which this shipped as for one revision — measures 3.44:1
          and fails 1.4.3 outright.** This is 9px text, so it is "normal" text and owes the full
          4.5:1; there is no large-text exemption to spend here. If it ever needs to look
          quieter, take it out of the type size or the tracking, never out of the contrast. */}
      <p
        data-card-credit=""
        style={{
          margin: 0,
          textAlign: "center",
          fontSize: "0.5625rem",
          lineHeight: 1.3,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          fontWeight: "var(--weight-medium)",
          color: "var(--cb-sheet-ink-soft)",
          opacity: 0.8,
        }}
      >
        Made with Contact Book
      </p>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        data-card-credit-logo=""
        src={CREDIT_LOGO_SRC}
        alt=""
        aria-hidden="true"
        /* Stated so the foot reserves its box before the asset arrives: without them the card
           reflows by 35px the moment the mark loads, which on the public page is a visible jump
           under the reader's thumb. The pair is the asset's own pixel size, and `height: auto`
           below keeps the rendered box on that ratio at whatever width the card is read at. */
        width={CREDIT_LOGO_INTRINSIC.width}
        height={CREDIT_LOGO_INTRINSIC.height}
        style={{
          display: "block",
          width: `${CREDIT_LOGO_WIDTH}px`,
          height: "auto",
        }}
      />
    </div>
  );
}
