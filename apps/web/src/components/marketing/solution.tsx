import type { CSSProperties, ReactNode } from "react";

import { CardPageThumb } from "@/card/card-page-thumb";
import { resolveCard } from "@/card/resolve-card";
import { paletteVars } from "@/card/template-palettes";
import { FIXTURE_DB } from "@/fixtures";
import { exampleCardSpecs, marketingUser, solution } from "@/fixtures/marketing";

import { mkcn } from "./mk-cn";
import { Section } from "./section";
import { accented, HEAD_TO_BODY, Prose, SectionHead } from "./type";

/**
 * Section 3 — the solution.
 *
 * ## ⚠ REBUILT 2026-09-21 (FIFTH ATTEMPT). THE MATRIX IS GONE; THE EXHIBIT IS THREE REAL CARDS
 *
 * The verdict this pass answers, verbatim: *"What are these dots? Why are the colours of Work,
 * Family and Just met changing? How does it make sense, and how are these dots connecting?"*
 *
 * That was not a styling complaint and it is worth being precise about the cause, because four
 * previous passes each fixed a real problem and each landed somewhere worse:
 *
 *   1. Two lists of words          → "weak, expresses nothing".
 *   2. A three-way segmented control → made a reader press something before the section meant
 *      anything.
 *   3. One card beside the profile  → showed *a* subset, never that one profile yields
 *      different cards.
 *   4. A 12 × 3 dot matrix          → the verdict above.
 *
 * Read together those four rule out almost everything: the exhibit must show **three cards at
 * once**, must need **no press**, and must be **an object rather than a diagram**. Exactly one
 * pattern satisfies all three, and it is the one every product in this category already uses.
 *
 * ## ⚠ WHY THE MATRIX WAS THE WRONG GENRE, NOT A BAD DRAWING
 *
 * A comparison grid is the notation for **mutually exclusive choices** — Nielsen Norman's own
 * framing is that a shopper does not need a comparison table to pick a dress, because they are
 * not limited to one. **An owner holds all three of these cards at the same time.** There is no
 * choice being made, so there is nothing for a grid to compare. Their finding on why columns
 * confuse is almost word for word the reaction above: readers *"will easily forget which column
 * is for which"*. And a filled dot is an unlabelled symbol, which their icon work is blunt
 * about — if the meaning is not immediate, the mark *"is reduced to mere eye candy"*.
 *
 * Measured, before this pass, at 1024px: this section was **1627px tall with zero images, zero
 * card renders and the most words on the page** — twice the height of any neighbour, carrying
 * the least. `how-it-works` makes its point in 830px with four real card renders. The section
 * whose entire job is "here is what a card is" was the only one on the page with no card in it.
 *
 * ## What is here now
 *
 * One band of twelve chips — the profile, everything the owner has added — and beneath it the
 * three cards drawn from it, as **real `<CardPage>` renders**. Same person at the top of each,
 * visibly different depths: six rows, five, two. A reader who reads nothing has still seen one
 * person's details becoming three different cards, which is `solution.lead` performed rather
 * than asserted.
 *
 * ⚠ **The cards are not new art and not a mockup.** `exampleCardSpecs` already carries
 * `card_mk_business` (sapphire, 6 fields), `card_mk_personal` (clay) and `card_mk_limited`
 * (onyx, exactly mobile + work email) — which *are* Work, Family and Just met, palette for
 * palette. `how-it-works.tsx:209-230` has rendered them through `CardPageThumb` for a month.
 * The matrix was drawing dots to stand in for three finished cards twenty lines away in the
 * same fixture file. {@link EXAMPLE_FOR} is the whole of the new wiring.
 *
 * ## The one beat, and why the static state still makes the argument
 *
 * A 12s clock walks the three cards, 4s each: the lit card rises, and the chips it carries
 * light in its own colour. That is the filter claim performed — one list of fields, read three
 * different ways.
 *
 * ⚠ **It is an enhancement and nothing depends on it.** Under `prefers-reduced-motion` no chip
 * ever lights and no card ever rises, and the section still says everything it needs to: here
 * is everything you have; here are three cards made from it, obviously different. That is the
 * real reason the triptych beat the alternatives — a switcher or a scroll-morph has *nothing*
 * to say at rest, and this section has now failed twice by requiring the reader to do something
 * before it meant anything.
 *
 * ⚠ **Nothing is dimmed, deliberately.** The obvious walk recedes the two unlit cards to ~55%
 * opacity. It is not done, for two reasons: the page-wide AA sweep in
 * `tests/e2e/marketing.spec.ts` walks every text node against its computed ground, and a
 * faded card render is exactly the kind of thing that fails it — and, more importantly, the
 * matrix's real sin was making one colour channel mean three things at once (which card, how
 * important, which column is currently lit). The lit card rises. Colour only ever means *which
 * card*.
 *
 * ## The claims this exhibit does NOT try to carry
 *
 * The edit beat ("change it once, everyone holding it sees the new one") and the revoke beat
 * both lived in the matrix, performed on 8px dots, and were invisible. They are **removed, not
 * lost**: `solution.paragraphs[1]` still makes the live claim in prose, `honesty` qualifies it,
 * and `how-it-works` steps 04 and 05 are about exactly those two things. An exhibit that tries
 * to carry three claims lands none, which is the lesson of attempts 1 and 4 both.
 *
 * The live edit deserves its own object rather than a share of this one. That is the next piece
 * of work here, not a gap in this one.
 *
 * ## The constraints this file lives under, unchanged
 *
 * `tests/unit/marketing-solution.test.tsx` scans this file's own source text: no client
 * boundary, no motion runtime, no colour literal, no `@/lib/cn`, and every property inside
 * every `@keyframes` block of `marketing-solution.css` must be `opacity` or `transform`. All
 * still hold. The one assertion this pass changed is the exhibit's "no buttons" rule, which
 * became "nothing focusable" — see {@link CardTile}.
 */

/* ── the three cards, wired to the three renders that already exist ──────────────────────── */

/**
 * Which `exampleCardSpecs` entry stands for each `solution.cards` entry.
 *
 * ⚠ Mapped by **id**, not by palette or by index. Matching on `paletteId` would look tidier and
 * is a trap: two example cards could share a palette, and the pairing would then depend on
 * array order in a fixture this file does not own. Throwing on a miss is the same fail-loud
 * convention `how-it-works.tsx` uses for the identical lookup.
 */
const EXAMPLE_FOR: Record<string, string> = {
  work: "business",
  family: "personal",
  "just-met": "limited",
};

function exampleCardFor(cardId: string) {
  const exampleId = EXAMPLE_FOR[cardId];
  const spec =
    exampleId === undefined
      ? undefined
      : exampleCardSpecs.find((candidate) => candidate.id === exampleId);
  if (!spec) throw new Error(`solution: no example card fixture for "${cardId}"`);
  return spec.card;
}

/**
 * How far down each card the tile's window reaches, in the card's own design px.
 *
 * ⚠ 620 and not the share face's 500, for the reason `card-thumb-tile.tsx` documents at length:
 * about 478px of a card is cover and identity, so a 500px window shows **no field rows at all**
 * — and the rows are the entire argument here. Two cards on one template are told apart by
 * their rows. 620 shows three or four before the veil takes over.
 */
const CARD_CROP_HEIGHT = 620;

const TOTAL_FIELDS = solution.profile.length;
const PROFILE_LABEL_ID = "solution-profile-label";
const CARDS_LABEL_ID = "solution-cards-label";

/** Bridged, cross-skin marketing tokens — the three `solution.cards[].paletteId` values today,
 *  reproduced by NAME through tokens `marketing.css` already bridges rather than by importing
 *  the card system's palette data. A palette id this map does not know falls back to ink.
 *
 *  `ink` is not decorative: `--mk-clay` is a light terracotta needing dark type on it (8.12:1),
 *  while sapphire and onyx are dark grounds needing white (12.27:1 and 15.97:1). Getting that
 *  pair wrong is what the page-wide AA sweep exists to catch. */
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
 * `private` has no `private` property in its inferred type at all — not `private: undefined` —
 * so `field.private` does not type-check across the union. `"private" in field` narrows to the
 * one member that actually carries it.
 */
function isPrivateField(field: (typeof solution.profile)[number]): boolean {
  return "private" in field && field.private === true;
}

function carriersOf(fieldId: string) {
  return solution.cards.filter((card) => (card.fields as readonly string[]).includes(fieldId));
}

/* ── the profile band ───────────────────────────────────────────────────────────────────── */

/**
 * Everything the owner has added, as twelve chips on one line.
 *
 * ⚠ **A band, not a column, and that is most of the height this pass gave back.** The same
 * twelve fields as a 12-row stack with three columns beside them was the matrix, and it was
 * 1627px of section. Wrapped inline they are four or five lines.
 *
 * ⚠ **Each chip is a WORD, which is the whole fix.** A dot needed a legend; "Mobile" does not.
 * A reader who watches "Mobile" light blue while the Work card rises has been told what the
 * relationship is without a key, a caption or a header row to hold in their head.
 *
 * The lit overlays are a stack of duplicate labels, one per card that carries the field, each
 * painted in that card's ground and faded in on its own slice of the clock. They are
 * `aria-hidden`: the accessible fact is the sentence at the end of the chip, which is written
 * from the same data the overlays are, so the two cannot drift.
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

            {/* The one sentence a screen reader needs per field. The overlays are decorative;
                "which cards carry this" is the fact they encode. */}
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

/* ── one card ───────────────────────────────────────────────────────────────────────────── */

/**
 * One of the three cards, as the product actually draws it.
 *
 * ⚠ **THE "NO BUTTONS IN THE EXHIBIT" RULE BECAME "NOTHING FOCUSABLE", AND THAT IS A CHANGE OF
 * LETTER, NOT OF SPIRIT.** The rule exists because attempt 2 failed by making a reader press
 * something before the section meant anything, and that intent is untouched: there is still no
 * control here, nothing to operate, and no state a reader can change. But `<CardPage>` renders a
 * real action and a real link per row — that is what makes it the product rather than a picture
 * of it — so "zero buttons" can no longer express the rule. `<CardPageThumb>` renders its whole
 * subtree `inert`, which removes every one of them from the tab order and the accessibility
 * tree together, so the guarantee a reader actually experiences is unchanged. The unit test
 * asserts that instead.
 *
 * ⚠ **`paletteVars` on the frame, for the veil and nothing else.** The card crops at
 * {@link CARD_CROP_HEIGHT} and a crop through the middle of a field row looks broken — the same
 * defect `card-tile.css` documents. The veil fades to `--c-sheet`, the paper *this* card is
 * printed on, which is set inside the card root and therefore unreachable from a sibling
 * overlay. Fading to the exhibit's white instead would leave a pale band across the clay card.
 */
function CardTile({ card, index }: { card: (typeof solution.cards)[number]; index: number }) {
  const resolved = resolveCard(
    exampleCardFor(card.id),
    marketingUser,
    FIXTURE_DB.groups,
    FIXTURE_DB.fields,
  );

  return (
    <li data-solution-card="" data-mk-walk-col={index} className="mk-sol-card">
      <span className="mk-sol-card__frame" style={paletteVars(resolved.palette) as CSSProperties}>
        <CardPageThumb resolved={resolved} height={CARD_CROP_HEIGHT} />
        <span className="mk-sol-card__veil" />
      </span>

      <p className="mk-sol-card__name">{card.name}</p>
      <p className="mk-sol-card__note">{card.note}</p>
      <p className="mk-sol-card__count">
        {card.fields.length} of {TOTAL_FIELDS}
      </p>
    </li>
  );
}

/* ── the exhibit ────────────────────────────────────────────────────────────────────────── */

function SolutionExhibit() {
  return (
    <div
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
        {/* Static, and load-bearing under reduced motion: a reader who never sees the walk play
            still gets the claim in one word. */}
        <Tag>Live</Tag>
      </div>

      <ul aria-labelledby={CARDS_LABEL_ID} role="list" className="mk-sol-cards">
        {solution.cards.map((card, index) => (
          <CardTile key={card.id} card={card} index={index} />
        ))}
      </ul>
    </div>
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

      {/* ── the honesty paragraph. See the fixture: it may not be cut. ─────────────────── */}
      <div className="mt-14 max-w-mk-measure border-t border-mk-hairline pt-6 md:mt-16">
        <p className="font-mk-display text-mk-heading-sm font-mk-editorial text-mk-ink">
          {solution.honesty.term}
        </p>
        <Prose className="mt-3">{solution.honesty.detail}</Prose>
      </div>
    </Section>
  );
}
