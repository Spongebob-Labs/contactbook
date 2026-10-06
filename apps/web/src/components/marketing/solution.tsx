import type { CSSProperties, ReactNode } from "react";

import { Pause, Play } from "lucide-react";

import { heroPhone, solution } from "@/fixtures/marketing";

import { BrandCard } from "./brand-card";
import { brandCardContent } from "./brand-card-content";

import { mkcn } from "./mk-cn";
import { MkReveal } from "./mk-reveal";
import { Section } from "./section";
import { accented, HEAD_TO_BODY, Prose, SectionHead } from "./type";

/**
 * Section 3 — the solution.
 *
 * ## ⚠ SIXTH BUILD, 2026-09-28 — THE TRIPTYCH BECAME A DECK, ON THE CLIENT'S WORD
 *
 * The client, verbatim: *"Moving profile cards at bottom: make the swap animation more
 * dramatic. One card large in front, two slotted behind, rotating to front with bold label
 * ('Your Work Contact Card'). Add short descriptive text per card type: work, headhunter/CV,
 * family."* The three side-by-side cards with a 10px rise read as three thumbnails taking turns
 * to twitch. So the row is now ONE deck: the front card large, the other two behind it with
 * their top edges showing, and every ~4s the front card is flicked out and the next one rises
 * into its place — while a bold label beside the deck names it ("Your Family Contact Card")
 * with one line on what is on it and who it is for.
 *
 * ## What the five earlier builds taught, and why the deck still obeys it
 *
 * Two lists of words, a segmented control, one card, a 12 × 3 dot matrix and a triptych: the
 * rule that survived all five is **three real cards at once, no press required, an object not
 * a diagram**. The deck keeps all three:
 *
 *   · **Three at once.** All three cards are on screen at every instant — one in front, two
 *     showing their edges. Nothing is behind a tab.
 *   · **No press.** The rotation is automatic, and the static first paint (Work in front, its
 *     chips lit, all three names listed) already makes the argument. The one control in the
 *     exhibit is the pause toggle WCAG 2.2.2 requires of any motion that loops past 5s.
 *   · **An object.** Every card is the product's own `<CardPage>`, resolved from Maya
 *     Laurent's profile (`mayaProfile`), not a drawing of one.
 *
 * The profile band above the deck is unchanged in role: the chips the FRONT card carries light
 * in its own colour, on the same clock as the deck, so "one profile, many cards" is performed.
 *
 * ## The motion, and its rules
 *
 * CSS only — `marketing-solution.css` — so this stays a server component. Transform and
 * opacity only. The deck's stacking order changes without `z-index`: the deck is a 3D
 * rendering context and each pose carries a `translateZ`, so the browser depth-sorts the
 * cards. The rotation starts when the exhibit is scrolled into view (`<MkReveal>` flips
 * `data-mk-reveal` to `"in"`), never on page load. Under `prefers-reduced-motion` nothing
 * moves: the deck sits still with Work in front and the three names stack as a list, so every
 * label stays readable. With scripting off it is the same still picture.
 *
 * `tests/unit/marketing-solution.test.tsx` scans this file's source: no client boundary, no
 * motion runtime, no colour literal, no `@/lib/cn`, and every `@keyframes` property in the
 * stylesheet must be `opacity` or `transform`.
 */

/* ── the three cards ─────────────────────────────────────────────────────────────────────── */

/**
 * How far down each card the deck's window reaches, in the card's own design px.
 *
 * ⚠ 2026-10-06 (LATER) — 720 → 630, SO THE WHOLE EXHIBIT FITS ONE SCREEN. The client found it far
 * taller than a viewport ("half cut off", visible only at 80% zoom). 630 keeps the cover, the
 * name block, the Send to Phone pill and the first two or three rows; `marketing-solution.css` then steps the
 * card's scale down with the viewport's HEIGHT from `lg`, so panel + deck stay inside one screen.
 *
 * ⚠ 2026-10-06 — 560 → 720, BECAUSE THE CARD CHANGED. The deck now draws the brand card
 * (`brand-card.tsx`, the hero phone's card, on the client's word) instead of `<CardPageThumb>`.
 * Its header — cover, badge, wordmark, name, role, bio and the Send to Phone pill — is 472px,
 * so 560 would show one row; the rows are what tell the three cards apart, and the client asked
 * that each card keep its own subset visible. 720 shows the Family card whole (653px) and the
 * first two groups of Work and CV before the veil. The deck is ~128px taller at `lg` as a
 * result; nothing else in the section moves.
 */
const CARD_CROP_HEIGHT = 630;

const TOTAL_FIELDS = solution.profile.length;
const PROFILE_LABEL_ID = "solution-profile-label";
const CARDS_LABEL_ID = "solution-cards-label";

/** Bridged, cross-skin marketing tokens for each `solution.cards[].paletteId`. A palette id
 *  this map does not know falls back to ink. `ink` matters: `--mk-clay` is a light ground
 *  needing dark type (8.12:1); sapphire and onyx are dark grounds needing white. */
interface CardSkin {
  readonly ground: string;
  readonly ink: string;
  /** The same colour as `ground`, as a value — the brand card's cover tone (2026-10-06). */
  readonly tone: string;
}

const CARD_SKIN: Record<string, CardSkin> = {
  sapphire: { ground: "bg-mk-sapphire", ink: "text-mk-white", tone: "var(--mk-sapphire)" },
  clay: { ground: "bg-mk-clay", ink: "text-mk-ink", tone: "var(--mk-clay)" },
  onyx: { ground: "bg-mk-ink", ink: "text-mk-white", tone: "var(--mk-ink)" },
};

const FALLBACK_SKIN: CardSkin = { ground: "bg-mk-ink", ink: "text-mk-white", tone: "var(--mk-ink)" };

function cardSkin(paletteId: string): CardSkin {
  return CARD_SKIN[paletteId] ?? FALLBACK_SKIN;
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-mk-pill border border-mk-hairline-strong px-2 py-0.5 text-mk-caption font-mk-medium uppercase tracking-[0.08em] text-mk-pebble">
      {children}
    </span>
  );
}

const LABEL_CLASS = "text-mk-caption font-mk-medium uppercase tracking-[0.1em] text-mk-pebble";

/**
 * `solution.profile`'s `as const satisfies` narrowing means a field literal that omits
 * `private` has no `private` property in its inferred type at all, so `"private" in field`
 * narrows to the one member that carries it.
 */
function isPrivateField(field: (typeof solution.profile)[number]): boolean {
  return "private" in field && field.private === true;
}

function carriersOf(fieldId: string) {
  return solution.cards.filter((card) => (card.fields as readonly string[]).includes(fieldId));
}

/* ── the profile band ───────────────────────────────────────────────────────────────────── */

/**
 * Everything the owner has added, as twelve labelled chips.
 *
 * Each chip carries one lit overlay per card that holds the field, painted in that card's
 * ground and shown while that card is at the front of the deck. They are `aria-hidden`: the
 * accessible fact is the sentence at the end of the chip, written from the same data.
 */
function ProfileChips() {
  return (
    <ul aria-labelledby={PROFILE_LABEL_ID} role="list" className="mk-sol-chips">
      {solution.profile.map((field) => {
        const carriers = carriersOf(field.id);
        const isPrivate = isPrivateField(field);
        const state = isPrivate ? "private" : carriers.length > 0 ? "included" : "excluded";

        return (
          <li key={field.id} data-field-state={state} className="mk-sol-chip">
            <span className="mk-sol-chip__face">{field.label}</span>

            {carriers.map((card) => {
              const skin = cardSkin(card.paletteId);
              return (
                <span
                  key={card.id}
                  aria-hidden="true"
                  data-mk-walk-col={solution.cards.indexOf(card)}
                  className={mkcn("mk-sol-chip__lit", skin.ground, skin.ink)}
                >
                  {field.label}
                </span>
              );
            })}

            {isPrivate ? <Tag>{solution.privateTag}</Tag> : null}

            <span className="sr-only">
              {carriers.length === 0
                ? "On no cards."
                : `On ${carriers.map((card) => card.name).join(", ")}.`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ── the deck ───────────────────────────────────────────────────────────────────────────── */

/**
 * One card of the deck — the brand card, the hero phone's design (2026-10-06).
 *
 * The client: these cards "don't look like our actual card", with the hero's card as the
 * reference. So each is now `<BrandCard layout="flow">`, carrying exactly its fixture fields
 * (`brand-card-content.ts` turns the field ids into rows), cropped by the same window and veil
 * the deck always used, at the same `--card-thumb-scale` steps (applied as `zoom`, as the hero
 * does, so the card is re-rasterised rather than resampled).
 *
 * ⚠ THE COVER IS THE PORTRAIT, TINTED IN EACH CARD'S OWN COLOUR — 2026-10-06 (LATER). The client:
 * the cards "should look good and give us the feel of the actual card that we have in the hero",
 * with the person's image rendered in them. So every card wears Maya's portrait, as the hero's
 * does. A bare identical portrait on all three would make the cards indistinguishable at the one
 * place they differ at a glance, and the colour is what ties a card to the chips it lights and
 * the swatch beside its name — so `tint` lays the card's colour over the photo's top edge, solid
 * at the rim and gone a third of the way down. The back cards show only that rim, so the stack
 * still reads as three colours; the front card shows a clean face.
 *
 * The card is `inert` and the deck `aria-hidden`; the names list beside the deck is what a
 * screen reader gets. The veil fades to the card's own sheet cream (`--c-sheet`).
 *
 * `data-mk-walk-col` is the card's place on the one clock (see the stylesheet); its resting
 * pose — front, first behind, second behind — is the same number.
 */
function DeckCard({ card, index }: { card: (typeof solution.cards)[number]; index: number }) {
  return (
    <div data-solution-card={card.id} data-mk-walk-col={index} className="mk-sol-deck__card">
      <span
        className="mk-sol-card__frame"
        style={{ ["--c-sheet" as string]: "var(--mk-phone-sheet)" } as CSSProperties}
      >
        <span
          className="mk-sol-card__crop"
          style={{ ["--mk-sol-crop" as string]: `${CARD_CROP_HEIGHT}px` } as CSSProperties}
        >
          <BrandCard
            layout="flow"
            cover={{ kind: "photo", x2: heroPhone.portrait.x2, x3: heroPhone.portrait.x3, tint: cardSkin(card.paletteId).tone }}
            idPrefix={`mk-sol-${card.id}`}
            {...brandCardContent(card.id)}
          />
        </span>
        <span className="mk-sol-card__veil" />
      </span>
    </div>
  );
}

/**
 * The pause control WCAG 2.2.2 requires: the rotation starts on its own and loops past 5s.
 *
 * A native checkbox inside its label, so it needs no client script: the stylesheet pauses every
 * animation in the exhibit with `:has(:checked)`. The visible word is the accessible name and it
 * tracks the state ("Pause" → "Paused"), so voice control and screen readers hear what sighted
 * users read. Hidden under reduced motion and before the reveal, when nothing is moving.
 */
function PauseToggle() {
  return (
    <label className="mk-sol-pause">
      <input type="checkbox" className="mk-sol-pause__input sr-only" />
      <span aria-hidden="true" className="mk-sol-pause__icon" data-when="running">
        <Pause size={12} strokeWidth={2.25} />
      </span>
      <span aria-hidden="true" className="mk-sol-pause__icon" data-when="paused">
        <Play size={12} strokeWidth={2.25} />
      </span>
      <span className="mk-sol-pause__text" data-when="running">
        {solution.pauseLabel}
      </span>
      <span className="mk-sol-pause__text" data-when="paused">
        {solution.pausedLabel}
      </span>
    </label>
  );
}

function SolutionExhibit() {
  return (
    <MkReveal
      move="rise"
      data-solution-exhibit=""
      data-mk-demo=""
      data-mk-elevation="card"
      className={mkcn(
        HEAD_TO_BODY,
        "overflow-hidden rounded-mk-block border border-mk-hairline bg-mk-white p-5 sm:p-8 md:px-10 md:py-7",
      )}
    >
      <p id={PROFILE_LABEL_ID} className={LABEL_CLASS}>
        {solution.profileLabel}
      </p>
      <p className="mt-1 text-mk-body-sm text-mk-stone">{solution.allLabel}</p>

      <ProfileChips />

      <div className="mk-sol-divide">
        <p id={CARDS_LABEL_ID} className={LABEL_CLASS}>
          {solution.cardsLabel}
        </p>
        <Tag>Live</Tag>
        <PauseToggle />
      </div>

      <div className="mk-sol-stage">
        {/* Back to front in the DOM, so a browser that cannot depth-sort still paints the
            resting deck in the right order. */}
        <div className="mk-sol-deck" aria-hidden="true">
          {[...solution.cards].reverse().map((card) => (
            <DeckCard key={card.id} card={card} index={solution.cards.indexOf(card)} />
          ))}
        </div>

        <ul aria-labelledby={CARDS_LABEL_ID} role="list" className="mk-sol-names">
          {solution.cards.map((card, index) => (
            <li key={card.id} data-mk-walk-col={index} className="mk-sol-name">
              <span
                aria-hidden="true"
                className={mkcn("mk-sol-name__swatch", cardSkin(card.paletteId).ground)}
              />
              <p className="mk-sol-name__title">{card.title}</p>
              <p className="mk-sol-name__note">{card.note}</p>
              <p className="mk-sol-name__count">
                {card.fields.length} of your {TOTAL_FIELDS} details
              </p>
            </li>
          ))}
        </ul>
      </div>
    </MkReveal>
  );
}

export function Solution() {
  return (
    <Section id="solution" tone="white" labelledBy="solution-heading">
      <SectionHead
        heading={accented(solution.heading, solution.accent)}
        headingId="solution-heading"
        lead={solution.lead}
      />

      <div className="mt-5 space-y-4">
        {solution.paragraphs.map((paragraph) => (
          <Prose key={paragraph} className="max-w-mk-measure">
            {paragraph}
          </Prose>
        ))}
      </div>

      {/* 2026-10-06: the section ends on the exhibit. The sentence that sat under it was
          removed on the client's instruction; see the note in `fixtures/marketing.ts`. */}
      <SolutionExhibit />
    </Section>
  );
}
