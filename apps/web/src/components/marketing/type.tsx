import type { ReactNode } from "react";
import Link from "next/link";

import { mkcn } from "./mk-cn";

/**
 * The marketing type and control vocabulary — design.md's components, as code.
 *
 * ## Why these are here and not in `src/components/primitives/`
 * That directory is the PRODUCT's component library: it is built on the app-chrome tokens,
 * it is used by every authenticated screen, and its `<Button>` is a near-black pill in a
 * white room. The marketing site is a different room with a different type SCALE (a four-step
 * display ladder no app screen has, its own measures, its own tracking) on a warm off-white
 * ground. Reusing the app's primitives here would either drag app tokens onto marketing
 * surfaces or force a variant flag onto every product control for the benefit of one route.
 *
 * ⚠ The two rooms share a display FACE and a palette, and that is deliberate as of this pass.
 * Space Grotesk is the app's display face and marketing's; the nine hues are the card system's
 * and marketing's. The separation that matters is the layer — `--mk-*`, `mkcn`, this file —
 * not a second set of colours and a second serif, which is what the layer had drifted into.
 *
 * The boundary is mechanical: every class in this file resolves to an `mk-` token. Nothing in
 * here can be used on a product screen without it looking obviously wrong, which is the point.
 *
 * ## The typographic rule this file encodes
 * design.md pairs a display face with a workhorse and is explicit about the split:
 *
 *   · **`<Display>` and `<Heading>`** set the display face (Space Grotesk) at the two large
 *     steps, with **negative** tracking. The sign flipped with the face: it was Fraunces, a
 *     Cooper Black / Windsor revival whose signature is open letterspacing at size, and a
 *     grotesque at 72px with +0.02em does not read as editorial, it reads as a headline that
 *     failed to justify. Per-step values and reasoning are in `marketing.css`.
 *   · **Everything else** — body, labels, buttons, nav, eyebrows, panel titles — is Geist.
 *
 * The display face is for display: no body text, no buttons, no product UI. There is therefore
 * no small-size variant of `<Display>` in this file, on purpose. The one place the display face
 * appears below 30px is the wordmark, which is a name rather than a label.
 */

/* ── Type ──────────────────────────────────────────────────────────────────── */

/**
 * The eyebrow — 11px, uppercase, 0.1em tracking.
 *
 * ⚠ **Never above a section heading.** A kicker over a headline is banned outright: the heading
 * carries its own weight, and a label above it is the page apologising for it. Every
 * `overline` field was removed from the copy fixture for this reason and `SectionHead` no
 * longer accepts one.
 *
 * What survives is the case this was actually good at: naming a landmark above a LIST, which is
 * the footer's two navigation columns. That is a label, not a kicker.
 *
 * design.md specifies 10px. At 10px with 0.1em tracking uppercase text is below the
 * legibility floor this project holds everywhere else, so the size is 11px and design.md's
 * tracking is kept. It is the one place a stated value was overruled for a reason other than
 * contrast.
 */
export function Eyebrow({
  children,
  className,
  id,
  as: As = "p",
}: {
  children: ReactNode;
  className?: string;
  /** Set where the eyebrow is the accessible name of a landmark — the footer's nav columns. */
  id?: string;
  as?: "p" | "h2" | "h3";
}) {
  return (
    <As
      id={id}
      className={mkcn(
        "font-mk-sans text-mk-eyebrow font-mk-medium uppercase text-mk-pebble",
        className,
      )}
    >
      {children}
    </As>
  );
}

/**
 * design.md's Section Eyebrow Pill — a white pill that floats above a headline. Used on the
 * gradient sky, where a bare eyebrow in `--mk-pebble` would not hold against the blue.
 */
export function EyebrowPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={mkcn(
        "inline-flex items-center rounded-mk-pill bg-mk-white/90 px-3 py-1",
        "font-mk-sans text-mk-caption font-mk-medium text-mk-ink",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** The hero step — the display face at 44→72px. One per page. */
export function Display({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={mkcn(
        "font-mk-display text-mk-display font-mk-editorial text-mk-ink",
        // `balance` keeps a three-line display headline from leaving one orphan word, which
        // at 72px is the difference between a headline and an accident.
        "text-balance",
        className,
      )}
      {...rest}
    >
      {children}
    </h1>
  );
}

/**
 * A section headline — the display face at 32 to 48px, or 36 to 60px at `size="xl"`.
 *
 * ⚠ `size="xl"` is for ONE section. The page's type hierarchy only works if the hero owns the
 * display step alone and every other head shares one step below it; an `xl` on a second band
 * would put two competing headlines on the page and flatten both. It exists for `broadcast`,
 * whose heading is the argument the whole page is built around, and which otherwise had to
 * choose between looking like every other section or out-sizing the hero.
 */
export function Heading({
  children,
  className,
  id,
  size = "lg",
  as: As = "h2",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  size?: "lg" | "xl";
  as?: "h2" | "h3";
}) {
  return (
    <As
      id={id}
      className={mkcn(
        "font-mk-display font-mk-editorial text-mk-ink text-balance",
        size === "xl" ? "text-mk-heading-xl" : "text-mk-heading-lg",
        className,
      )}
    >
      {children}
    </As>
  );
}

/**
 * A panel or column title — Geist, 24px, **negative** tracking.
 *
 * ⚠ The mechanism that separates the two families changed with the display face, and this
 * comment is where it used to be recorded backwards. With Fraunces the split was directional —
 * the serif opened up as it grew, the sans tightened — so a 24px positive-tracked display
 * setting was the size at which the two collapsed into one. Space Grotesk tightens at size too,
 * so direction can no longer do the work: **the pairing is now carried by the letterforms**
 * (single-storey `g`, straight-tailed `y`, angular `k` against Geist's neutral humanist
 * shapes) and by degree — -0.03em at the display step against this step's -0.02em. A panel
 * title is Geist and stays Geist; setting one in the display face is what would flatten the
 * pairing now.
 */
export function PanelTitle({
  children,
  className,
  as: As = "h3",
}: {
  children: ReactNode;
  className?: string;
  as?: "h3" | "h4" | "p" | "dt";
}) {
  return (
    <As
      className={mkcn("font-mk-sans text-mk-heading-sm font-mk-strong text-mk-ink", className)}
    >
      {children}
    </As>
  );
}

/**
 * Body copy. `tone="ink"` is **required inside a wash** — see `SectionProps.tone`: stone
 * measures under 4.5:1 on all four pastel grounds.
 */
export function Prose({
  children,
  className,
  size = "body",
  tone = "stone",
  as: As = "p",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  size?: "lead" | "body" | "small";
  tone?: "stone" | "ink";
  /**
   * The element. Body copy is not always a paragraph — it is a `<dd>` in a definition list, an
   * `<li>` in a ruled list, a `<span>` inside a caption. Without this, every such site retypes
   * `font-mk-sans text-mk-body-sm text-mk-stone` by hand, which is how a type system quietly
   * becomes a convention.
   */
  as?: "p" | "dd" | "li" | "span" | "div";
  /**
   * Rest props are forwarded, and that is load-bearing rather than convenience: without it a
   * `data-*` hook set at a call site is silently swallowed, which is exactly how the roadmap
   * disclosure's test target went missing while the markup looked correct.
   */
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As
      {...rest}
      className={mkcn(
        "font-mk-sans",
        size === "lead" && "text-mk-subheading",
        size === "body" && "text-mk-body",
        size === "small" && "text-mk-body-sm",
        tone === "stone" ? "text-mk-stone" : "text-mk-ink",
        className,
      )}
    >
      {children}
    </As>
  );
}

/* ── Controls ──────────────────────────────────────────────────────────────── */

/**
 * Six button treatments, and no seventh.
 *
 * `dark` is the primary action on a light ground: `--mk-ink` (Onyx) with white, 17.41:1.
 * `amber` is the primary action on a dark ground — see the variant table below for why the
 * page has two primaries and where each one is legal.
 *
 * `white` is a secondary treatment on a dark ground — "no border, no shadow, relies on the
 * backdrop for contrast" — and `glass` is the translucent version of the same idea.
 *
 * ⚠ `line` is the sixth, added when the hero moved onto paper. It is the LIGHT-ground
 * secondary, and until the hero left the sky the page did not have one: `glass` needs a dark
 * backdrop to be a surface at all, `white` on paper is a 1.06:1 boundary, and `ghost` draws no
 * boundary by design. A hero offering two destinations on a light sheet needs a second control
 * that a sighted reader can find, which is a WCAG 1.4.11 obligation and not a style preference.
 */
export type MkButtonVariant = "dark" | "white" | "ghost" | "amber" | "glass" | "line";

const BUTTON_BASE =
  "inline-flex items-center justify-center rounded-mk-control font-mk-sans font-mk-medium " +
  "transition-[background-color,color,transform,box-shadow] duration-[var(--mk-dur-tap)] " +
  "ease-[var(--mk-ease)] active:translate-y-px";

/**
 * ⚠ **`amber` is the primary action, and it may only be drawn on a DARK ground.**
 *
 * It was `lime` — `#7efa55`, which carried near-black at 12.25:1 and was chosen for exactly
 * that. The arithmetic was right and the colour was wrong: Live Lime is one of the two hues
 * the card system was rejected over ("nobody hands out a cyan business card") and it came back
 * into this layer from a separate brief. The action is now Amber `#E1AA40`, a card ground, with
 * Amber's own `buttonInk` `#3A2408` on it. Both values are copied out of
 * `template-palettes.ts`; neither was picked here.
 *
 *     label  #3A2408 on the fill      6.98:1   ← the pair the cards already ship
 *     fill   on the sky's zenith      6.38:1
 *     fill   on the Onyx close        8.31:1
 *     fill   on paper                 1.92:1   ← ILLEGAL
 *     fill   on white                 2.09:1   ← ILLEGAL
 *
 * The last two lines are the constraint, and it is a WCAG 1.4.11 one rather than a taste one:
 * on paper the fill has no findable boundary, so the control stops being locatable before its
 * label is read. Amber is legal in exactly two places on this page — the hero, on the sky, and
 * the close, on Onyx — and both are dark by design. **A light pass wanting a primary action
 * uses `dark`**, which is what `PillNav` already does. Lime never had this constraint, because
 * a colour bright enough to sit on anything is also bright enough to shout on everything.
 *
 * `glass` is the hero's secondary. It is a real effect and not decoration: it sits on a
 * gradient that shifts under it, so a flat white fill would read as a hole punched in the sky
 * while a translucent surface reads as something lying on it. Its ring composites to 3.92:1
 * against the zenith and 4.47:1 at the horizon, and the white label on the 15% fill measures
 * 8.48:1 at the worst point — all three better than on the old bright sky.
 */
const BUTTON_VARIANT: Record<MkButtonVariant, string> = {
  // The shadow is Amber's own deep ink, not a green glow and not neutral black: a coloured
  // fill casting a grey shadow is the tell that the shadow was typed rather than observed.
  amber:
    "bg-mk-amber text-mk-amber-deep hover:brightness-[1.06] shadow-[0_10px_24px_-8px_rgb(58_36_8/0.55)]",
  glass:
    "bg-mk-white/15 text-mk-white ring-1 ring-inset ring-mk-white/45 hover:bg-mk-white/25",
  dark: "bg-mk-ink text-mk-white hover:bg-mk-ink/90",
  white: "bg-mk-white text-mk-ink hover:bg-mk-white/90",
  ghost: "text-mk-ink hover:bg-mk-ink/5",
  // The ring is ink at 55%, which composites to #7b7c7f — 3.81:1 on paper. The alpha is the
  // measured floor rounded up, not a round number: 45% gives 2.85:1 and fails 1.4.11 while
  // looking, to the eye, like a perfectly reasonable hairline. Anything below 48% fails.
  //
  // No fill. The hero's dark primary is the only saturated mass on the sheet and a second
  // filled pill beside it would split the focal point in two, which is the specific thing a
  // two-action hero has to avoid.
  line: "text-mk-ink ring-1 ring-inset ring-mk-ink/55 hover:bg-mk-ink/5",
};

const BUTTON_SIZE = {
  md: "px-4 py-2.5 text-mk-body-sm",
  lg: "px-6 py-3.5 text-mk-body",
} as const;

export function MkButtonLink({
  href,
  children,
  variant = "dark",
  size = "md",
  className,
  ...rest
}: {
  href: string;
  children: ReactNode;
  variant?: MkButtonVariant;
  size?: keyof typeof BUTTON_SIZE;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link
      href={href}
      className={mkcn(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}

/* ── Layout helpers ────────────────────────────────────────────────────────── */

/**
 * The standard section head: eyebrow, headline, and an optional lead paragraph on a short
 * measure.
 *
 * `align` defaults to `start`. design.md centres "the hero headline and section H1s" and
 * nothing else, and centring every band is the layout half of looking generated — so the
 * default is left and centring is a per-section decision a reader can count.
 */
export function SectionHead({
  heading,
  headingId,
  lead,
  size = "lg",
  align = "start",
  className,
  tone = "stone",
}: {
  /**
   * A node rather than a string, so a section can set ONE phrase of its heading in
   * `--mk-green-display` — the brand's own move, and the thing that makes a white page read as
   * ContactBook rather than as any white page. The deck does it on every slide ("How it
   * *Works*"), which is where the pattern comes from.
   *
   * ⚠ `--mk-green-display` (#43A491, 3.01:1 on white) is the ONLY green legal for a word, and
   * only at a heading size — 3:1 is the large-text bar. The brand value itself (#5ABCA9) is
   * 2.28:1 and may never be type. See the green ladder in `marketing.css`.
   */
  heading: ReactNode;
  headingId?: string;
  lead?: string;
  size?: "lg" | "xl";
  align?: "start" | "center";
  className?: string;
  tone?: "stone" | "ink";
}) {
  return (
    <div
      className={mkcn(
        "flex flex-col gap-5",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      <Heading id={headingId} size={size} className="max-w-mk-measure-head">
        {heading}
      </Heading>
      {lead ? (
        <Prose size="lead" tone={tone} className="max-w-mk-measure">
          {lead}
        </Prose>
      ) : null}
    </div>
  );
}

/* ── The devices that were each invented several times over ───────────────────
   Everything below exists because sections independently solved the same visual
   job. A design system is the place a decision is made once. */

/**
 * The numeral device — a figure in the display face at the section-heading step.
 *
 * The page's substitute for iconography where a number is genuinely the content: the counts in
 * `problem`, the ordinals in `how-it-works`.
 *
 * ⚠ It is `text-mk-heading-lg`, never the display step. The display step belongs to the hero,
 * which is the page's one `<Display>`; a figure at 72px mid-page out-sizes the heading above it.
 */
export function Figure({
  children,
  className,
  tone = "ink",
  as: As = "p",
}: {
  children: ReactNode;
  className?: string;
  /**
   * `accent` was `lime` and set `--mk-signal-green`. It is `--mk-emerald-ink` now — the
   * lifted Emerald, 4.52:1 on paper, separating from the ink beside it at 3.53:1.
   *
   * ⚠ It is deliberately NOT the action colour, which is what `lime` used to be. Amber at a
   * level legal for text on paper is `#936917`, a dark ochre that no longer reads as the
   * action colour at all — so a mark meant to point at "this step is the one that repeats"
   * would have quietly stopped pointing at anything while keeping its name. Green is the
   * annotation; Amber is the button; the two do not overlap.
   */
  tone?: "ink" | "quiet" | "accent";
  as?: "p" | "dt" | "span" | "div";
}) {
  return (
    <As
      className={mkcn(
        "font-mk-display text-mk-heading-lg font-mk-editorial",
        tone === "ink"
          ? "text-mk-ink"
          : tone === "accent"
            ? "text-mk-emerald-ink"
            : "text-mk-pebble",
        className,
      )}
    >
      {children}
    </As>
  );
}

/**
 * A question at the 18px step, in ink. `assistant` and `faq` both render exactly this object
 * and each had built its own treatment, because nothing was exported between `PanelTitle`
 * (24px) and `Prose` (18px regular).
 */
export function QuestionTitle({
  children,
  className,
  as: As = "p",
}: {
  children: ReactNode;
  className?: string;
  as?: "p" | "h3" | "h4" | "span" | "dt";
}) {
  return (
    <As className={mkcn("font-mk-sans text-mk-subheading font-mk-strong text-mk-ink", className)}>
      {children}
    </As>
  );
}

/**
 * The closing caveat — a short qualification under a rule at the foot of a pass.
 *
 * ⚠ `tone="ink"` is required on a wash ground: `--mk-stone` measures 2.30-3.07:1 on the four
 * washes and fails AA there.
 */
export function Footnote({
  children,
  className,
  tone = "stone",
}: {
  children: ReactNode;
  className?: string;
  tone?: "stone" | "ink";
}) {
  return (
    <div className={mkcn("mt-12 border-t border-mk-hairline pt-6", className)}>
      <Prose size="small" tone={tone} className="max-w-mk-measure">
        {children}
      </Prose>
    </div>
  );
}

/**
 * An inline text link — the treatment design.md does not list, named rather than assembled by
 * cancelling every part of a ghost button.
 */
export function TextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={mkcn(
        "font-mk-sans text-mk-body font-mk-medium text-mk-ink underline decoration-1",
        "transition-colors duration-[var(--mk-dur-tap)] hover:text-mk-sapphire-ink",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * The gap between a pass's head and the body beneath it. One value, applied as a top margin on
 * the body. It was solved eleven times at five different values from 32 to 64px.
 */
/**
 * A heading with one phrase set in the brand green.
 *
 * Every section headline on the client's deck does this — "How it **Works**", "This Week's
 * Example: **Charlie Moretti**" — and it is the single thing that makes a white page read as
 * ContactBook rather than as any white page. Five sections use it, so the split lives here
 * rather than as the same three lines of JSX copied five times.
 *
 * ⚠ THE GREEN IS `--mk-green-display` (#419F8D) AND IT IS LEGAL AT HEADING SIZES ONLY.
 * It measures 3.01:1 on the wash and 3.19:1 on white, which clears the LARGE-text bar of 3:1
 * and nothing else. Below 24px (or 18.66px bold) the same colour is illegal, so this helper
 * must never be reached for on a paragraph or a label — `--mk-green-ink` is the level for
 * those. `marketing.spec.ts` asserts the size gate on every rendered instance.
 *
 * ⚠ `accent` MUST BE A SUBSTRING OF `heading`. It is matched from the right, because these
 * accents are trailing phrases and a short one ("works.") could otherwise match earlier in a
 * longer sentence. A miss renders the heading plain rather than throwing — a headline is worth
 * more than a stack trace — so the spec asserts that every section renders exactly one accent,
 * which is what turns a silent miss into a failing test.
 */
export function accented(heading: string, accent: string): ReactNode {
  const at = heading.lastIndexOf(accent);
  if (at < 0) return heading;
  return (
    <>
      {heading.slice(0, at)}
      <span className="text-mk-green-display" data-accent="">
        {accent}
      </span>
      {heading.slice(at + accent.length)}
    </>
  );
}

export const HEAD_TO_BODY = "mt-12 md:mt-16";

/**
 * The interior rule between cells of a repeated set. ONE construction and ONE weight, drawn by
 * the element that FOLLOWS each shared edge, so the outer edges of the set stay clean and no
 * interior edge is drawn twice.
 *
 * ⚠ On a pastel wash the neutral hairline reads as a cold grey line on a warm ground; `ON_WASH`
 * is the same device in the ground's own hue.
 */
export const RULE = {
  STACK: "[&>*+*]:border-t [&>*+*]:border-mk-hairline",
  ROW_MD: "[&>*+*]:border-t [&>*+*]:border-mk-hairline md:[&>*+*]:border-t-0 md:[&>*+*]:border-l",
  ROW_LG: "[&>*+*]:border-t [&>*+*]:border-mk-hairline lg:[&>*+*]:border-t-0 lg:[&>*+*]:border-l",
  ON_WASH: "[&>*+*]:border-t [&>*+*]:border-mk-ink/15",
  ON_WASH_ROW_MD:
    "[&>*+*]:border-t [&>*+*]:border-mk-ink/15 md:[&>*+*]:border-t-0 md:[&>*+*]:border-l md:[&>*+*]:pl-10",
} as const;
