import type { CSSProperties, ReactNode } from "react";

import { Pause, Play } from "lucide-react";

import { CardPageThumb } from "@/card/card-page-thumb";
import { resolveCard } from "@/card/resolve-card";
import { paletteVars } from "@/card/template-palettes";
import { exampleCardSpecs, marketingUser, mayaProfile, solution } from "@/fixtures/marketing";

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

/* ── the three cards, wired to the three renders that already exist ──────────────────────── */

/**
 * Which `exampleCardSpecs` entry stands for each `solution.cards` entry. Mapped by id, never by
 * palette or index: two example cards could share a palette. Throws on a miss, the same
 * fail-loud convention `how-it-works.tsx` uses for the identical lookup.
 */
function exampleCardFor(cardId: string) {
  const spec = exampleCardSpecs.find((candidate) => candidate.id === cardId);
  if (!spec) throw new Error(`solution: no example card fixture for "${cardId}"`);
  return spec.card;
}

/**
 * How far down each card the deck's window reaches, in the card's own design px.
 *
 * About 478px of a card is cover and identity, so a shorter window shows no field rows — and
 * the rows are what tell the three cards apart. 560 shows two or three before the veil.
 */
const CARD_CROP_HEIGHT = 560;

const TOTAL_FIELDS = solution.profile.length;
const PROFILE_LABEL_ID = "solution-profile-label";
const CARDS_LABEL_ID = "solution-cards-label";

/** Bridged, cross-skin marketing tokens for each `solution.cards[].paletteId`. A palette id
 *  this map does not know falls back to ink. `ink` matters: `--mk-clay` is a light ground
 *  needing dark type (8.12:1); sapphire and onyx are dark grounds needing white. */
interface CardSkin {
  readonly ground: string;
  readonly ink: string;
}

const CARD_SKIN: Record<string, CardSkin> = {
  sapphire: { ground: "bg-mk-sapphire", ink: "text-mk-white" },
  clay: { ground: "bg-mk-clay", ink: "text-mk-ink" },
  onyx: { ground: "bg-mk-ink", ink: "text-mk-white" },
};

const FALLBACK_SKIN: CardSkin = { ground: "bg-mk-ink", ink: "text-mk-white" };

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
 * One card of the deck, as the product draws it.
 *
 * `<CardPageThumb>` renders its whole subtree `inert`, so the card's own row actions and links
 * are out of the tab order and the accessibility tree; the names list beside the deck is what
 * a screen reader gets. `paletteVars` on the frame is for the veil only: it fades to
 * `--c-sheet`, the paper this card is printed on, which a sibling overlay cannot otherwise see.
 *
 * `data-mk-walk-col` is the card's place on the one clock (see the stylesheet); its resting
 * pose — front, first behind, second behind — is the same number.
 */
function DeckCard({ card, index }: { card: (typeof solution.cards)[number]; index: number }) {
  const resolved = resolveCard(
    exampleCardFor(card.id),
    marketingUser,
    mayaProfile.groups,
    mayaProfile.fields,
  );

  return (
    <div data-solution-card={card.id} data-mk-walk-col={index} className="mk-sol-deck__card">
      <span className="mk-sol-card__frame" style={paletteVars(resolved.palette) as CSSProperties}>
        <CardPageThumb resolved={resolved} height={CARD_CROP_HEIGHT} />
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
        "overflow-hidden rounded-mk-block border border-mk-hairline bg-mk-white p-5 sm:p-8 md:p-10",
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

      <SolutionExhibit />

      {/* The honesty line. See the fixture: it may not be cut. */}
      <Prose size="small" className="mt-6 max-w-mk-measure">
        {solution.honesty}
      </Prose>
    </Section>
  );
}
