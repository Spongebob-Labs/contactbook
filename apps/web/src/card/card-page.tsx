import type { CSSProperties, ReactElement, ReactNode } from "react";

import { ArrowUpRight, ChevronRight } from "lucide-react";

import { CardGround } from "@/card/card-ground";
import { actionAccessibleName, cardPageRows, type CardPageRow } from "@/card/card-page-rows";
import type { ResolvedSurface } from "@/card/card-surface";
import type { FieldIconSize } from "@/card/field-renderers";
import { paletteVars } from "@/card/template-palettes";
import type { CardTemplate } from "@/card/template-types";
import type { ResolvedCard } from "@/types/domain";

import "@/styles/card.css";

/**
 * THE CARD PAGE — the product itself, and what `/c/{slug}` serves to whoever opens the link.
 *
 * ## It is a link-in-bio page, not a spec sheet
 *
 * Contact Book has two verticals and this is the one people actually use. The other is the
 * wallet pass: the rigid 336×500 `<ShareFace>` with a QR on it, an object whose entire job is
 * to be added to Apple/Google Wallet and scanned. This is what that scan *resolves to* — the
 * Contact Book mark, the owner's face and name, and then a **stack of tappable buttons, one
 * per field they added**. Tap "Work email" and your mail client opens. Tap "WhatsApp" and the
 * thread opens. Nothing to read first.
 *
 * ### ⚠ The buttons print the LABEL and not the value, deliberately
 *
 * This is the instruction most likely to be "fixed" by someone who thinks a field is missing
 * its data, so it is stated here rather than left to be inferred: **the card shows "Email",
 * not the address.** The action is what the button does. A stack of buttons each wearing a
 * 34-character address is a list of strings you have to read, which is precisely the labelled
 * `LABEL / value` list this design replaced — the value adds nothing to a control you are
 * about to press, and it costs the button its shape.
 *
 * The value is not lost. It is spoken: `actionAccessibleName()` puts it in the button's
 * `aria-label`, so a screen-reader user knows the destination before pressing it and a sighted
 * one gets the same information by pressing. See that function for why `aria-label` rather
 * than visually hidden text (hidden text lands in `innerText`, which two suites assert on).
 *
 * ### Not every field is a button
 *
 * A stack where everything is a button makes nothing look tappable. Three shapes, decided by
 * `card-page-rows.ts` from the row contract and nothing else:
 *
 *   - **actionable** (`href !== null`) → a full-width button, `[data-card-action-button]`.
 *   - **descriptive** (`href === null`) → quiet text, `[data-card-note]`. A job title is not
 *     a destination and dressing one as a control is a lie about what a tap will do.
 *   - **masked** (`masked === true`) → its masking, never actionable, never revealed (§7.3).
 *     Reveal exists in `/profile` and nowhere else; this page is unauthenticated, so a
 *     revealed account number is a published one.
 *
 * ## It is a page, not a canvas
 *
 * It has a width and no height: it grows to fit however many fields the owner mapped and
 * scrolls with the document, like any other web page.
 *
 * There is **no `overflow` container anywhere in this file**, and that absence is the fix for
 * the defect that made the previous build unusable. That build rendered one 400×860 card for
 * every purpose, so a card with twenty-five fields had to fit them into whatever vertical
 * space was left after a 196px protected QR zone and two action buttons — about two hundred
 * pixels. The only way to do that is `overflow-y: auto`, so the card grew a scrollbar inside
 * itself and silently clipped its own last row. Every screenshot of that build shows it: a
 * "5 fields" label above four visible fields, a truncated wallet address, a cut-off label.
 *
 * A field list does not belong on a fixed canvas. It belongs here, where nothing is fixed.
 *
 * ⚠ **The ground added by the material system does not reintroduce one.** It is an
 * out-of-flow layer with `inset: 0` — it contributes nothing to the card's scroll area in
 * either axis, and `tests/e2e/public-card.spec.ts` measures exactly that
 * (`scrollWidth - clientWidth <= 0` on the root and on the document).
 *
 * ## The material system — four axes, and where each one is applied
 *
 * `card-surface.ts` is the shared vocabulary; this file is the renderer. The four axes:
 *
 *   1. **ground colour** — `resolved.palette`, reaching the subtree as `--c-*` custom
 *      properties and never read as a literal here.
 *   2. **finish and texture** — how the colour is laid down and what is cut into it, painted by
 *      `<CardGround>`, which owns every contrast argument the treatments raise.
 *   3. **pattern** — which motif, when the style is `pattern`.
 *   4. **header layout** — `classic | banner | hero | minimal`, the table below.
 *
 * ⚠ **Layout changes composition and nothing else.** It never changes which fields appear,
 * what they do, or their order. A look that silently dropped a field would be a card lying
 * about what it shares, and `cardPageRows()` — the one place that decides — is not passed the
 * layout at all, so this is structural rather than a rule to remember.
 *
 * ## ⚠ The ground holds still, and how that is arranged without breaking two other screens
 *
 * `<CardGround>` renders **one out-of-flow painted element behind `position: relative`
 * content**. On `/c/{slug}` `card.css` promotes it to `position: fixed`, so the content column
 * scrolls over a ground that does not move. That is DESIGN.md's single most characterful
 * moment in motion and it costs one element.
 *
 * It is `position: fixed` and **not** `background-attachment: fixed`, which iOS Safari does
 * not implement dependably — and a phone browser is the only surface this page is guaranteed
 * to be read on.
 *
 * The promotion is opt-in, from outside, and that polarity is load-bearing: `position: fixed`
 * escapes any ancestor that is not a containing block, and `overflow` does not make one. Two
 * of this component's three consumers are scrolled frames (the builder's preview, the
 * marketing page's card objects), where a fixed ground would leave its frame and paint the
 * whole viewport. See the head of `card-ground.tsx` and §1 of `card.css`.
 *
 * ## ⚠ THERE IS NO QR ON THIS PAGE, AND THAT IS THE POINT
 *
 * This file used to end with a `<QrZone>` at the foot, on the argument that *"a scanned card is
 * also a re-shareable card"*. That argument is overruled, and the reason is simple enough that
 * it is worth stating so nobody re-derives the old one: **whoever is looking at this page has
 * already opened the card.** The symbol they would have found down here encodes
 * `resolved.qrPayload` — the URL of the page they are already on. It is a button that reloads
 * the current document, dressed up as a share affordance.
 *
 * The QR belongs on the **share face**, which is the object that actually gets handed over:
 * displayed on a phone, exported to PNG, printed, photographed off a desk. `<ShareFace>` is the
 * one and only surface in this product that renders a scannable symbol, and the entire QR
 * contract suite (`tests/e2e/qr-*.spec.ts`) measures it there — on `/cards/[cardId]`, where the
 * face renders at its unscaled design size. Not one assertion was dropped in the move; see the
 * migration note at the head of `tests/e2e/qr-geometry.spec.ts`.
 *
 * Re-sharing is not lost, it is just not a QR: a reader who wants to pass this card on has the
 * URL in their address bar, and the owner has the face.
 *
 * ## The DOM contract another track codes against
 *
 * Stable and asserted elsewhere — do not rename any of these:
 * `[data-card-root]`, `[data-card-variant="page"]`, `[data-template-id]`, `[data-palette-id]`,
 * `[data-page-header]`, `[data-render-mode]`, `[data-card-fields]` carrying `data-field-count`,
 * `[data-card-field="{id}"]` on every item, `[data-card-field-row]`, `[data-card-field-masked]`,
 * `[data-card-field-value]`, `[data-card-hero]`, `[data-card-name]`, `[data-card-portrait]`,
 * `[data-card-brand]`, `[data-card-row-kind]`, `[data-card-action-button="{id}"]`,
 * `[data-card-note="{id}"]`.
 *
 * ⚠ **`data-page-header` carries the template's own legacy `pageHeader`**
 * — because that is the axis DESIGN.md defines and the builder's Design panel sets. The
 * template's own legacy `PageHeader` (`solid | band | quiet`) has not been deleted, it is the
 * default when a card has not chosen a layout, and it is published separately as
 * `[data-template-page-header]` so nothing that needs it has to infer it back.
 *
 * Added by the material system, all readable and all safe to assert on:
 * - `[data-surface-style]` and `[data-pattern-id]` on the root — the resolved axes.
 * - `[data-card-ground]` carrying `data-card-surface-style` — the painted layer.
 * - `[data-card-ground-motif]` — the pattern or grain tint, when there is one.
 * - `[data-card-body]` — the block below the hero, so the two regions can be addressed apart.
 * - `[data-card-on-palette]` on the hero and the body — `"true"` when that region stands on
 *   the painted ground. `card.css` keys `::selection` and the caret off it, and a screenshot
 *   sweep can read it instead of guessing from a colour.
 * - `[data-card-row-surface]` on every field button — the same fact, per control.
 */

export interface CardPageProps {
  resolved: ResolvedCard;
  /**
   * The real action controls, injected by the route.
   *
   * A slot rather than buttons built in, because "Save to contacts" writes a `.vcf` through
   * a blob URL and needs client state, while this component is otherwise renderable on the
   * server. The builder's preview passes inert look-alikes through the same slot, so the
   * preview and the live page cannot drift apart in layout.
   *
   * The two controls it carries — Save to contacts, Message on WhatsApp — are the card's own
   * actions and sit **above** the field stack. They are a different tier from the field
   * buttons below: those are the owner's data, these are what the reader does with the card.
   */
  actions?: ReactNode;
  className?: string;
}

/** §8.8's middle size. Big enough to carry a row on its own at 44px+ of tap target. */
const ROW_ICON_SIZE: FieldIconSize = 20;

/**
 * The tap-target floor for a field button, in px.
 *
 * 44 is the pointer-target minimum and what `<CardActionButton>` uses; this stack sits 8px
 * above it because a thumb scrolling a page of them needs the extra margin for error, and
 * because a 44px button under a 44px "Save to contacts" reads as the same tier of control
 * when it is not.
 */
const ACTION_MIN_HEIGHT = 52;

/* ── the four header layouts ────────────────────────────────────────────────── */

/**
 * The name's three sizes, and why none of them is a viewport clamp any more.
 *
 * ⚠ **The card page is not the width of the viewport, so a `vw` clamp sized it from a number
 * that has nothing to do with the box it is in.** `--text-h1` is `clamp(2rem, 1.25rem +
 * 1.5625vw, 2.75rem)` — a heading scale written for a full-bleed app screen. The card renders
 * at `--page-measure` (460px) at most, and inside the builder's phone frame at 336px, while the
 * *viewport* behind both is a 1440px desktop. So the clamp resolved at its ceiling — 44px — and
 * set a two-word name at 44/1.08 in a 288px column: three lines of shouting, which is the "messy,
 * not sleek" this scale replaces.
 *
 * Container query units (`cqi`) are the textbook fix here and they are **not usable on this
 * component**: `container-type: inline-size` applies `contain: layout`, which makes the element
 * a containing block for `position: fixed` descendants.
 *
 * ⚠ That argument has changed shape but not conclusion. It used to be fatal — the ground WAS
 * `position: fixed` to the viewport on `/c/{slug}`, and a container query on the card root would
 * have pinned it to the card and silently undone it. As of `card.css` §1b the ground is
 * `absolute` on every surface, so `contain: layout` no longer breaks it. The sizes still are not
 * container queries, for the second reason below: they are chosen against the two widths the card
 * is read at, and a container query would make a name's size a function of the viewport again.
 *
 * So the sizes are absolute and chosen against the two widths the card is ever read at. They are
 * a scale rather than four literals so a change is a change to the *system*: the display size is
 * the lead size plus one step, never an unrelated number.
 */
const NAME_SIZE = {
  /** `classic` / `banner` — 26px. A name, set with authority, that still fits "Priyanka
   *  Raghunathan" on two comfortable lines at 288px and on one at 460px. */
  lead: "1.625rem",
  /** `hero` — 34px. The one layout where the name is the subject and the portrait its caption. */
  display: "2.125rem",
  /** `minimal` — 20px, beside a 52px portrait. Quiet is the layout's whole definition. */
  quiet: "1.25rem",
} as const;



/**
 * How the one composition is measured, as data rather than as literals scattered through the
 * markup.
 *
 * ## ⚠ There used to be four of these, and the axis is gone
 *
 * `classic | banner | hero | minimal` was a `HeaderLayout` axis with its own builder tab. It
 * was cut: four near-identical diagram chips is a weak control, and three of the four existed
 * mainly to move the palette *off* parts of the page — which fights the rule that the ground
 * paints edge to edge. `classic` is what remains, and it is the most card-like of the four:
 * the palette runs the full height, the identity and the field stack both stand on it.
 *
 * The three booleans `minimal` needed — `painted`, `heroOnPalette`, `bodyOnPalette` — are gone
 * with it rather than frozen at `true`, because a constant that is always true is a branch
 * nobody will ever delete. `card-ground.tsx` lost its `painted` prop for the same reason.
 */
interface LayoutSpec {
  /** Portrait diameter, px. */
  portrait: number;
  /** Centred identity, or ranged left. */
  align: "center" | "start";
  /** The name's size. */
  nameSize: string;
}

const LAYOUT: LayoutSpec = {
  portrait: 80,
  align: "center",
  nameSize: NAME_SIZE.lead,
};


/** Every axis of the material system, made concrete, plus the composition's own measurements. */
export interface CardPageSurface extends ResolvedSurface, LayoutSpec {}

/**
 * The single resolution of "what does this card look like", exported so the page's actions
 * and its chrome cannot come to a different answer than the card does.
 *
 * `public-card-actions.tsx` used to need `bodyOnPalette` to pick a button colourway — a palette's
 * primary fill is defined against that palette's ground, and Onyx's is `#FFFFFF`, which is
 * invisible on the white app canvas. That decision used to be a local
 * `template.pageHeader === "solid"` in three files. It is one function now.
 */
export function cardPageSurface(resolved: ResolvedCard): CardPageSurface {
  /* `resolveCard` now carries the axes, already concrete — the structural cast this used to need
     is gone, and with it the possibility of the renderer and the resolver disagreeing about the
     defaults. The legacy fallback stays for the one axis that has a pre-existing source: a card
     that never chose a header layout inherits the one its template always implied. */
  const axes = resolved.surface;
  return { ...axes, ...LAYOUT };
}

export function CardPage({ resolved, actions, className }: CardPageProps): ReactElement {
  const { template } = resolved;
  /* The resolved palette — the card's own choice if it made one. Never looked up from the
     template here: that would ignore the owner's colour. */
  const palette = resolved.palette;
  const surface = cardPageSurface(resolved);

  const root: CSSProperties = {
    ...(paletteVars(palette) as CSSProperties),
    fontFamily: "var(--font-sans)",
    width: "100%",
    /* The card root is a positioning context, and now it is load-bearing twice over: it scopes
       anything absolutely positioned inside the card, AND it is what the ground pins to in
       every consumer that has not opted into the fixed layer. */
    position: "relative",
    /* ⚠ **A column, so the body can take up the slack — and this is the fix for "the background
       disappears when I remove the fields".**

       The ground is `inset: 0` of THIS element, and this element had no height of its own, so
       its height was the height of whatever the owner happened to have mapped. Take the fields
       off and the card shrank to a hero, the ground shrank with it, and the frame's own white
       showed through underneath — which reads, correctly, as the card losing its background
       for a reason that has nothing to do with colour. Field count is not a design axis.

       So: the card is a flex column and the body below the hero is the flexible track. Wherever
       the card is given room — the builder's phone frame, a marketing tile, and now `/c/{slug}`
       too — the body takes all of it and the ground is painted edge to edge whether the card
       shares five fields or none.

       ⚠ **`/c/{slug}` used to be the exception and no longer is.** The parent's height there is
       indefinite, so there was no free space to distribute and the invariant was held instead by
       promoting the ground to `position: fixed`, i.e. by painting the viewport. That ended when
       the card became an inset, rounded object: a fixed layer can be neither inset nor rounded.
       `card.css` §1b now gives the article `flex: 1` on that surface, which is the same mechanism
       as the other two consumers rather than a second one. Nothing in THIS file changed for it —
       which is the point of the absence the file rests on.

       ⚠ Still no height, no max-height and no overflow — the absence the whole file rests on.
       `flex-grow` cannot shrink a box below its content: a twenty-five-field card is laid out
       exactly as it was, and it is the FRAME that runs out of room and scrolls. */
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
      data-page-header={template.pageHeader}
      data-finish={surface.finish}
      data-texture={surface.texture}
      data-render-mode="full"
      className={className}
      style={root}
    >
      {/* ── the ground ───────────────────────────────────────────────────────── */}
      <CardGround
        palette={palette}
        finish={surface.finish}
        texture={surface.texture}
        texturePresence={surface.texturePresence}
        textureScale={surface.textureScale}
      />

      <header
        data-card-hero=""
        data-card-on-palette="true"
        style={{
          /* ⚠ TRANSPARENT when the identity stands on the palette — the ground is painted by
             the layer above, once, for the whole page. The hero used to paint
             `--c-ground-gradient` itself, which is why the ground scrolled: there were as
             many grounds as there were regions. */
          /* Always transparent: the ground behind is painted edge to edge, and the identity
             stands on it. This used to branch on `heroOnPalette`, which only `minimal` ever
             set false. */
          background: "transparent",
          color: "var(--c-ink)",
          /* Above the ground, and above the body — the `hero` layout's portrait hangs over
             the body's top edge and the body is an opaque sheet that would otherwise cover
             its lower half. */
          position: "relative",
          zIndex: 2,
          paddingBlock: "var(--space-8)",
          paddingInline: "var(--space-6)",
        }}
      >
        <IdentityBlock resolved={resolved} spec={surface} />
      </header>

      {/* ── body ─────────────────────────────────────────────────────────────── */}
      <div
        data-card-body=""
        data-card-on-palette="true"
        style={{
          /* Transparent on the palette, an opaque canvas sheet otherwise. Opaque matters: it
             is what makes `banner` a band rather than a wash, by covering the fixed ground
             from the fold down. */
          background: "transparent",
          color: "var(--c-ink)",
          position: "relative",
          zIndex: 1,
          /* The flexible track — see the ⚠ on the root. It takes any room the frame has spare,
             which is what keeps `banner`'s canvas sheet running to the bottom edge of a short
             card instead of ending halfway down it. */
          flexGrow: 1,
          /* ⚠ **No radius here, and the comment this replaced claimed one.**

             What stood here described rounding the body's top corners "so the two colours read
             as paper laid on a surface" — for `banner` and `hero`, two layouts deleted with the
             `HeaderLayout` axis. It was never applied: the style object below sets padding and
             nothing else, so the sentence had been describing an intention for some months. That
             is worse than no comment, and it is why this one is explicit.

             The radius the card actually has belongs to the ARTICLE, once, and it comes from
             `card.css` §1b — where it can be scoped to `/c/{slug}` and kept off the builder's
             preview, which is already inside a rounded, clipping frame of its own. The body is
             transparent on the painted ground, so it has no edge of its own to round. */
          paddingTop: "var(--space-8)",
          /* ⚠ A variable with the old value as its default, so the number can be
             tuned per surface without this file knowing which surface it is on.
             `card.css` §1b lowers it on `/c/{slug}` only: 40px of padding under
             the last row was right when the card ran to the bottom of the
             document with no end, and is dead space now that the card is an
             object whose own edge sits 12px from the screen. The builder's
             preview and the marketing tiles keep the original value. */
          paddingBottom: "var(--cb-card-body-pad-bottom, var(--space-10))",
          paddingInline: "var(--space-6)",
        }}
      >
        <div
          style={{
            maxWidth: "var(--page-measure)",
            marginInline: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          {/* Rendered bare. The actions component supplies its own `[data-card-actions]`
              container and its own count: whether there are two controls, one, or none depends
              on the card's data, and only that component knows. */}
          {actions ?? null}

          {/* The stack is the last thing on the page. A `<QrZone>` used to follow it — see the
              module note for why a QR pointing at the page you are already reading is not a
              share affordance. Nothing replaced it: the page simply ends with the owner's
              fields, which is what a scan is for. */}
          <FieldStack
            resolved={resolved}
            onPalette
            shape={template.shape.buttonShape}
          />
        </div>
      </div>
    </article>
  );
}

/* ── the identity block ─────────────────────────────────────────────────────── */

/**
 * The mark, the portrait, the name and the bio — the same four things in all four layouts,
 * arranged four ways.
 *
 * ⚠ Nothing is conditional except **position and size**. No layout hides the bio, none drops
 * the mark, none substitutes the card's name for the owner's. `HEADER_LAYOUTS` in
 * `card-surface.ts` states that as a rule; this function is where it is either kept or
 * broken, so the branch below is on composition only and every branch renders the same set.
 */
function IdentityBlock({
  resolved,
  spec,
}: {
  resolved: ResolvedCard;
  spec: CardPageSurface;
}): ReactElement {
  const onPalette = true;

  const name = (
    <h1
      data-card-name=""
      style={{
        fontSize: spec.nameSize,
        fontWeight: resolved.template.type.nameWeight,
        letterSpacing: `${resolved.template.type.nameTracking}em`,
        lineHeight: 1.12,
        color: "inherit",
        margin: 0,
        /* A two-line name breaks evenly instead of leaving one word alone on the second line.
           Purely typographic: `balance` cannot change where the box ends, only where the words
           inside it break, so nothing that measures the card's width is affected. */
        textWrap: "balance",
        /* The one thing that stops a long name in a 288px column from producing a sideways
           scrollbar on a long surname. E-15 and E-53 both measure it. */
        overflowWrap: "anywhere",
      }}
    >
      {resolved.fullName}
    </h1>
  );

  const bio =
    resolved.bio === null ? null : (
      <p
        style={{
          fontSize: "var(--text-base)",
          color: onPalette ? "var(--c-ink-soft)" : "var(--ink-3)",
          margin: 0,
          overflowWrap: "anywhere",
        }}
      >
        {resolved.bio}
      </p>
    );

  const words = (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 0 }}>
      {name}
      {bio}
    </div>
  );

  const column: CSSProperties = {
    maxWidth: "var(--page-measure)",
    marginInline: "auto",
    display: "flex",
    flexDirection: "column",
    alignItems: spec.align === "center" ? "center" : "flex-start",
    gap: "var(--space-4)",
    textAlign: spec.align === "center" ? "center" : "left",
    minWidth: 0,
  };

  /* Mark, portrait, name, bio — centred on the ground. The one composition. */
  return (
    <div style={column}>
      <BrandMark onPalette={onPalette} />
      <PagePortrait resolved={resolved} px={spec.portrait} />
      {words}
    </div>
  );
}

/**
 * The Contact Book wordmark, at the head of the card.
 *
 * Small, quiet and **not a link**. §8D.5 gives this page exactly one way out — the "Made with
 * Contact Book" caption under the card — and a second exit at the top, above the owner's own
 * name, would be the product advertising itself louder than the person whose card this is. It
 * is a mark, not a nav: `tests/e2e/public-card.spec.ts` asserts this page carries no `<nav>`
 * and no app chrome at all.
 *
 * Overline type at `inkSoft`, which `PALETTE_CONTRACT` proves clears 4.5:1 on **every gradient
 * stop** — and which `card-ground.tsx` re-proves against every treatment laid over that
 * ground, because a mesh bloom or a pattern tint sits between this text and the colour the
 * contract measured.
 */
function BrandMark({ onPalette }: { onPalette: boolean }): ReactElement {
  return (
    <p
      data-card-brand=""
      style={{
        margin: 0,
        fontSize: "var(--text-overline)",
        lineHeight: "var(--text-overline-lh)",
        letterSpacing: "var(--text-overline-tracking)",
        textTransform: "uppercase",
        fontWeight: "var(--weight-medium)",
        color: onPalette ? "var(--c-ink-soft)" : "var(--ink-3)",
      }}
    >
      Contact Book
    </p>
  );
}

/** The page's portrait — always a circle, always present. Only its diameter varies by layout. */
function PagePortrait({ resolved, px }: { resolved: ResolvedCard; px: number }): ReactElement {
  const base: CSSProperties = {
    width: `${px}px`,
    height: `${px}px`,
    borderRadius: "var(--radius-full)",
    overflow: "hidden",
    flexShrink: 0,
  };

  if (resolved.avatar.kind === "photo") {
    return (
      <span data-card-portrait="photo" style={base}>
        {/* A plain img element rather than next/image: see the note in share-face.tsx —
            next/image's markup does not survive html-to-image serialisation. (Written without
            the literal tag in the prose: `impeccable`'s broken-image rule is a text regex and
            reads an angle-bracketed tag in a comment as a real one with no `src`.) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolved.avatar.url}
          alt={resolved.avatar.alt}
          width={px}
          height={px}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </span>
    );
  }

  return (
    <span
      data-card-portrait="monogram"
      aria-hidden="true"
      style={{
        ...base,
        background: "var(--c-mark-bg)",
        color: "var(--c-mark-ink)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${Math.round(px * 0.34)}px`,
        fontWeight: "var(--weight-semibold)",
        lineHeight: 1,
      }}
    >
      {resolved.avatar.initials}
    </span>
  );
}

/* ── the stack ──────────────────────────────────────────────────────────────── */

/**
 * Every field the owner mapped, as a button or as a note, with nothing clipped and nothing
 * scrolled.
 *
 * A real `<ul>` rather than a stack of divs: this is a list of destinations, and a screen
 * reader announcing "list, 5 items" before the first one is the difference between a stack a
 * blind reader can navigate and one they have to walk blindly. `role="list"` is stated
 * explicitly because Safari drops the implicit list role the moment `list-style: none` is
 * applied — the one style every button stack needs.
 *
 * It replaced a `<dl>`, and the change is not cosmetic. A description list is a set of
 * term/description pairs, and an actionable row **has no description on this page** — the
 * value is not printed. A `<dt>` with an empty `<dd>` is a worse lie about the content than a
 * list item is.
 */
function FieldStack({
  resolved,
  onPalette,
  shape,
}: {
  resolved: ResolvedCard;
  onPalette: boolean;
  shape: CardTemplate["shape"]["buttonShape"];
}): ReactElement | null {
  /**
   * ⚠ `fields` **and** `socialFields`, concatenated in exactly the order `buildVcf` writes them.
   *
   * `resolveCard` splits social links into their own array, and this stack used to render only
   * `fields` — so LinkedIn, Instagram, GitHub, X and Mastodon were invisible on the shared card.
   * That is a hole in the product's whole premise (a page of tappable links whose most obviously
   * tappable links are missing) and, less visibly, a broken invariant: `buildVcf` writes
   * `[...resolved.fields, ...resolved.socialFields]`, so the `.vcf` a scanner saved carried
   * profiles the page it came from never showed. AC-22's claim is that the visible set and the
   * file set are the same set.
   *
   * The concatenation is deliberate rather than a re-sort: it mirrors `buildVcf` line for line,
   * so the two agree on order as well as membership. Re-sorting here would put the page and the
   * file in different orders and quietly reopen the same gap from the other side.
   */
  const rows = cardPageRows([...resolved.fields, ...resolved.socialFields], ROW_ICON_SIZE);

  /* Not an empty list: a zero-field card renders as identity + actions and nothing else, and
     an empty `<ul>` would still occupy the stack's gap in the column. */
  if (rows.length === 0) return null;

  return (
    <ul
      data-card-fields=""
      /* The count is the number of rows PAINTED, never `resolved.fields.length`. Declaring
         more than is drawn is the old build's defect, and the unit suite compares the two. */
      data-field-count={rows.length}
      role="list"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        listStyle: "none",
        margin: 0,
        padding: 0,
      }}
    >
      {rows.map((entry, index) => (
        <li
          key={entry.field.id}
          data-card-field-row=""
          /* The field's own id, so a test (or a bug report) can name one row rather than an
             nth-child. */
          data-card-field={entry.field.id}
          /* Which of the three shapes this row took. Published so a classification bug reads
             as the wrong value rather than as a missing element. */
          data-card-row-kind={entry.kind}
          /* Marks a row whose value is masked on every public surface. The security assertions
             in `tests/e2e/public-card.spec.ts` count these. */
          {...(entry.kind === "masked" ? { "data-card-field-masked": "" } : {})}
          /* THE STACK RISES — this row's place in the one authored moment. `+ 2` because the
             two card actions above it hold positions 0 and 1; `card.css` multiplies by 40ms
             and caps the result, and the whole animation lives inside
             `prefers-reduced-motion: no-preference`. It is a number and never a style: the
             row's painted state is its default, and the animation only says where it came
             from. */
          style={{ minWidth: 0, ["--cb-rise-index" as string]: index + 2 } as CSSProperties}
        >
          {entry.kind === "action" ? (
            <ActionRow entry={entry} onPalette={onPalette} shape={shape} />
          ) : (
            <NoteRow entry={entry} onPalette={onPalette} />
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * An actionable field: a full-width button carrying the owner's label and nothing else.
 *
 * ## The colours, and why they are the palette's *secondary* pair
 *
 * Three tiers have to stay distinguishable on this page: "Save to contacts" (the card's
 * primary action), "Message on WhatsApp" (its secondary), and however many field buttons the
 * owner added. If the field buttons took `buttonBg` — the palette's *primary* fill — they
 * would be indistinguishable from Save, and a page whose most prominent control is repeated
 * nine times has no most-prominent control. So the stack is the outline tier:
 * `buttonAltBg` / `buttonAltInk` / `buttonAltBorder`, which `PALETTE_CONTRACT` proves at
 * 4.5:1 for the label and 3:1 for the boundary on **every gradient stop**.
 *
 * ## `surface` is a correctness argument, not a style
 *
 * A palette's button colours are defined against that palette's own ground. Onyx's primary
 * fill is `#FFFFFF`, which is right on an onyx card and **invisible on the white app canvas**
 * — and both shipped templates resolve to `banner`, so the canvas case is the one every real
 * card actually renders. `<CardActionButton>` learned this the hard way (see its note); the
 * same split is applied here rather than re-derived:
 *
 *   - **on the palette** (`classic`): the alt trio above, as validated.
 *   - **on the canvas** (`banner`, `hero`, `minimal`): a whisper of the palette over white,
 *     edged and iconed in `canvasActionBg` — the one palette colour `PALETTE_CONTRACT` proves
 *     ≥3:1 against the app canvas, which is exactly what WCAG 1.4.11 asks of a control
 *     boundary. The label stays `--ink`: `canvasActionBg` is only proven to 3:1, which is a
 *     boundary threshold and not a text one, so using it for the label would be borrowing a
 *     non-text ratio for text.
 *
 * The 6% tint is a `color-mix` and its failure mode is benign: an engine that cannot parse it
 * drops the declaration, the button falls back to the canvas it is standing on, and the
 * border and icon still describe the control.
 *
 * ## Response, and why the hover state is not in this file
 *
 * `card.css` lifts the button 1px and brightens its edge on hover, and returns it flush on
 * press. The brightening is an `inset` box-shadow rather than a `border-color`, because the
 * border below is an inline shorthand and an inline declaration beats any stylesheet rule
 * that is not `!important` — see §3 of `card.css`. `[data-card-row-surface]` is what lets
 * that rule pick the right colour to brighten toward without re-deriving the split.
 */
function ActionRow({
  entry,
  onPalette,
  shape,
}: {
  entry: CardPageRow;
  onPalette: boolean;
  shape: CardTemplate["shape"]["buttonShape"];
}): ReactElement {
  const { row } = entry;
  /* Narrowed by the classifier — an `action` row has an href by definition. The fallback is
     unreachable and exists only so this component needs no non-null assertion. */
  const href = row.href ?? "#";
  const accent = onPalette ? "currentColor" : "var(--c-canvas-action-bg)";

  return (
    <a
      data-card-action-button={entry.field.id}
      data-card-row-surface={onPalette ? "palette" : "canvas"}
      href={href}
      /* AC-32: a destination that leaves the app never gets an opener handle on this tab. */
      {...(row.external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
      /* The value, spoken but not printed — see `actionAccessibleName`. */
      aria-label={actionAccessibleName(row)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "100%",
        minHeight: `${ACTION_MIN_HEIGHT}px`,
        paddingBlock: "var(--space-3)",
        paddingInline: "var(--space-4)",
        borderRadius: shape === "pill" ? "var(--radius-full)" : "var(--radius-md)",
        background: onPalette
          ? "var(--c-button-alt-bg)"
          : "color-mix(in srgb, var(--c-canvas-action-bg) 6%, var(--canvas))",
        color: onPalette ? "var(--c-button-alt-ink)" : "var(--ink)",
        border: `1px solid ${onPalette ? "var(--c-button-alt-border)" : "var(--c-canvas-action-bg)"}`,
        textDecoration: "none",
        fontSize: "var(--text-base)",
        fontWeight: "var(--weight-medium)",
        letterSpacing: "0.002em",
        cursor: "pointer",
      }}
    >
      {/* Both side slots are the same width so the label is optically centred between them.
          An icon of one size against a chevron of another shifts every label a few pixels
          left, which reads as a wobble down a stack of nine. */}
      <span
        aria-hidden="true"
        style={{
          display: "flex",
          flexShrink: 0,
          width: `${ROW_ICON_SIZE}px`,
          justifyContent: "center",
          color: accent,
        }}
      >
        {row.icon}
      </span>

      <span style={{ flex: 1, minWidth: 0, textAlign: "center", overflowWrap: "anywhere" }}>
        {row.label}
      </span>

      {/* The affordance the missing value used to provide: something at the end of the row
          that says "this goes somewhere". Which somewhere is the arrow's job — an outbound
          arrow for a destination that leaves the app, a chevron for one that stays with the
          phone (a dialler, a mail client, a map). */}
      <span
        aria-hidden="true"
        style={{
          display: "flex",
          flexShrink: 0,
          width: `${ROW_ICON_SIZE}px`,
          justifyContent: "center",
          color: accent,
        }}
      >
        {row.external ? (
          <ArrowUpRight size={16} strokeWidth={1.5} />
        ) : (
          <ChevronRight size={16} strokeWidth={1.5} />
        )}
      </span>
    </a>
  );
}

/**
 * A descriptive or masked field: quiet text, and never a control.
 *
 * These are the rows with nowhere to go — a job title, a company, a date, an availability
 * status, a live-location chip — plus every masked row, which has a value and is forbidden a
 * destination (§7.3, AC-33). Rendering them as buttons would be the more uniform stack and
 * the less honest one: a control the reader presses and nothing happens teaches them that
 * none of the other eight work either.
 *
 * They keep the same left inset as the buttons above them, so every icon on the page sits on
 * one vertical line and the stack reads as one column rather than two.
 */
function NoteRow({ entry, onPalette }: { entry: CardPageRow; onPalette: boolean }): ReactElement {
  const { row } = entry;
  const ink = onPalette ? "var(--c-ink)" : "var(--ink)";
  const inkSoft = onPalette ? "var(--c-ink-soft)" : "var(--ink-3)";

  return (
    <div
      data-card-note={entry.field.id}
      style={{
        display: "flex",
        gap: "var(--space-3)",
        alignItems: "flex-start",
        paddingBlock: "var(--space-2)",
        paddingInline: "var(--space-4)",
        minWidth: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "flex",
          flexShrink: 0,
          width: `${ROW_ICON_SIZE}px`,
          justifyContent: "center",
          color: inkSoft,
          /* Optically aligned with the first line of the label, not with the box. */
          marginTop: "2px",
        }}
      >
        {row.icon}
      </span>

      <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 }}>
        <span
          /* The same uppercase tag the face uses. Uniform across every template: a page whose
             labels are stacked on one card and inline on the next is varying its format with
             the palette. */
          style={{
            fontSize: "var(--text-overline)",
            lineHeight: "var(--text-overline-lh)",
            letterSpacing: "var(--text-overline-tracking)",
            textTransform: "uppercase",
            color: inkSoft,
          }}
        >
          {row.label}
        </span>

        {/* Both attributes on purpose: `data-field-value` is what `globals.css` targets for
            `overflow-wrap`, and `data-card-field-value` is the stable hook tests use — AC-33
            reads the masked string through it. `card.css` also gives it tabular figures: an
            account number whose digits shift width is read as data and must not wobble.
            `title` is `row.title`, which the renderer already replaced with the MASKED string
            on a masked row; a title is readable on hover and on copy, so a masked row carrying
            the raw one would be masked in appearance only. */}
        <span
          data-field-value=""
          data-card-field-value=""
          title={row.title}
          style={{ color: ink, fontSize: "var(--text-base)", display: "block", minWidth: 0 }}
        >
          {/* 1–2 lines; only `ADDRESS` uses two. No clamp and no ellipsis: this is the surface
              where the owner's data is shown in full, and it has the height to do it. */}
          {row.lines.map((line, i) => (
            <span key={i} style={{ display: "block" }}>
              {line}
            </span>
          ))}
        </span>

        {row.context === null ? null : (
          <span style={{ display: "block", fontSize: "var(--text-xs)", color: inkSoft }}>
            {row.context}
          </span>
        )}
      </div>
    </div>
  );
}
