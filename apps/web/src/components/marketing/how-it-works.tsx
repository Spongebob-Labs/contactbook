import {
  AtSign,
  BriefcaseBusiness,
  Building2,
  Link2,
  Mail,
  MapPin,
  Phone,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

import { resolveCard } from "@/card/resolve-card";
import { ShareFace } from "@/card/share-face";
import { formatPhoneDisplay } from "@/lib/format";
import {
  exampleCardSpecs,
  howItWorks,
  marketingUser,
  mayaProfile,
  solution,
} from "@/fixtures/marketing";
import type { ProfileField } from "@/types/domain";

import { MkReveal } from "./mk-reveal";
import { Section } from "./section";
import { accented, HEAD_TO_BODY, Prose, SectionHead } from "./type";
import { WorldMap } from "./world-map";

/**
 * Section 4 — how it works.
 *
 * ## 2026-09-28 — MAYA LAUREN, FOUR CITIES, AND A MAP
 *
 * The client: *"replace Indian numbers with London, Dubai, New York, Singapore addresses and
 * numbers. Consider adding a global map element to reinforce international feel."* So every
 * record here now resolves through `mayaProfile` (Maya Lauren, `fixtures/marketing-identity.ts`)
 * rather than `FIXTURE_DB` (the app's Mumbai fixture user): step 01's profile lists her New York
 * mobile and her London, Dubai and Singapore office lines, and steps 02 and 03 are her Work,
 * Family and CV cards. The map is a band of its own under the three frames — `world-map.tsx`
 * says why it is not behind step 03. Nothing else about the composition below changed.
 *
 * 2026-09-29: she is now the hero's Maya Laurent, so the mobile is the hero card's +44 one and
 * the four cities are Maya Partners' offices — four office lines, New York's included.
 *
 * ## ⚠ REBUILT AGAIN 2026-09-21 — THE THIRD ATTEMPT, AND THE FIRST ONE MEASURED
 *
 * The client's verdict on the five-column version: *"I don't think this is properly
 * explainable and properly understandable for the users at first glance because there is too
 * much text… the components that you have added into them are looking very vague… very
 * unprofessional."* That reading is correct, and the reason is arithmetic rather than taste.
 * Measured at 1440px on the version this replaces:
 *
 *   · `--mk-page-max` (1200) less the page gutters leaves **1120px of content**. Five columns
 *     plus four gaps put each step in **205px**.
 *   · Inside that, `<CardPageThumb scale={0.24}>` rendered the card **98×158** — 29% of its
 *     336×500 design size. The card's own name is authored at **30px** and was therefore
 *     painting at about **9px**, in a box **32px wide**. A person's full name in 32 pixels.
 *   · The 19-word step 04 wrapped to five lines of ~25 characters in that column.
 *
 * So "vague" was literal: the visuals were sub-legible by a factor of three. And "too much
 * text" was not a word count — at 75 words across the section this page is *shorter* than
 * Stripe Atlas (67 across four steps) or Cal.com (45 across three) by a hair, and the same
 * order. It was a LINE count, produced by pouring ordinary sentences into 205px columns.
 *
 * ## What the survey of comparable sites actually said
 *
 * Stripe Atlas, Cal.com, Linear, Notion, Raycast, Vercel, Attio, Ramp, Mercury, Superhuman,
 * Framer, Revolut, Wise, Blinq and HiHello were read directly. Three findings drove this
 * rebuild, and each contradicts something the previous version did:
 *
 *   1. **Nobody ships five steps.** Three is the mode (Cal.com, HiHello, Notion), four is the
 *      ceiling (Stripe Atlas, Raycast), and zero of the fifteen ship five. Comparable columns
 *      run **270–341px**, not 205.
 *   2. **The visual is the product's own UI, at a size where it is legible — never an icon,
 *      never a shrunken screenshot.** Stripe Atlas's single illustration is a vector redraw of
 *      the real Atlas dashboard at 1080×571; Cal.com's per-step fragments are live DOM at
 *      ~320×200 showing real availability rows. This file's own previous header argued the
 *      same principle ("the product's own UI is the strongest available illustration of its
 *      own steps") and then rendered it at 148px, which is how a correct principle produced a
 *      wrong page.
 *   3. **One construction method per row.** The single loudest amateur signal is mixing visual
 *      languages, and the previous version ran three side by side: authored linework (01, 05),
 *      rendered product thumbnails (02, 03, 04), and icon glyphs (the travelling link, the
 *      radiating signal). Stripe uses one drawing. Cal.com uses one construction. HiHello uses
 *      one plate style.
 *
 * ## ⚠ FIFTH BUILD, 2026-09-22 — THE COMPOSITION WAS THE DEFECT, NOT THE DETAILS
 *
 * Four rejections in a row, each answered by fixing the thing named — the crop, the tilt, the
 * rail alignment, the walk — and each producing the next rejection. The client's fifth was
 * *"What the hell is this? … it's looking very glitchy."* Looking at the fifth screenshot cold:
 * a white panel 40% empty below its last row; a card cut mid-address with a stranger's letters
 * peeking out of a sliver beside it; a navy face. Three different KINDS of object, three
 * different aspect ratios, in three identical columns — and no amount of alignment arithmetic
 * makes three unlike things read as one row. That was the mistake every earlier fix sat on.
 *
 * The survey's two findings that finally got applied together:
 *
 *   · **Cal.com's three columns work because all three fragments are the same construction at
 *     the same size.** Not the same *subject* — the same *kind of thing*.
 *   · **A crop needs a frame.** The hero's phone can cut a card because the bezel explains the
 *     cut. A bare card on cream has nothing to explain it, so every crop this section shipped
 *     read as a rendering bug.
 *
 * So: three IDENTICAL frames — same white panel, same height, same label register — and inside
 * every one of them the product's real share face (the one artefact the client said "was
 * looking more professional"), complete and uncropped. Step 01's frame holds the profile list,
 * because that is the source; step 02's holds three faces in three palettes stacked as a deck,
 * because "cards, plural, coloured" is the whole claim; step 03's holds one face, large — and it
 * is the top card of step 02's deck, so the reader watches one object go from a row in a list
 * to a card in a hand to the thing they scan. The frames make three unlike contents one row;
 * the shared face makes three columns one story.
 *
 * Nothing loops. One entrance, and then each frame's contents arrive in sequence — the rows,
 * then the deck deals, then the face lands — once, in about a second, and stop.
 *
 * ## The shape now
 *
 * **Three columns, not five.** At 1120px that is ~341px each — Cal.com's exact measure, and
 * the width at which a 14-word sentence is two lines instead of five. Not one word of the
 * client's copy is deleted: steps 04 and 05 move OUT of the rail and into the quiet pair
 * beneath it, because they are the only two that are not an action a person takes in sequence.
 * "Stay current" and "Stay in control" are properties the product then has forever, and giving
 * a property the same weight as a step is what made five equal columns read as a spreadsheet.
 *
 * **Cropped, never shrunk.** Every fragment is a 300×330 window onto a real surface at a scale
 * where its type is readable — `<CardPageThumb>`'s `height` prop is a CROP, not a scale, which
 * is the whole mechanism: the card renders at 0.62–0.7 and the window shows the part that
 * carries the meaning, rather than the whole object reduced until nothing in it is words.
 *
 * ## ⚠ THE ONE AUTHORED FRAGMENT, AND WHY IT IS NOT A FOURTH VISUAL LANGUAGE
 *
 * Step 01 is a profile, and a profile has no marketing-safe renderer: `components/profile/
 * field-row.tsx` is a `"use client"` component carrying edit, reorder and delete handlers, so
 * dropping it here would pull a client boundary into a server section and put three affordances
 * on the page that do nothing. {@link ProfileFragment} is therefore drawn — but drawn to the
 * SAME grammar as the two renders beside it (the card's own row rhythm, icon disc left, label
 * and value in the card's own two ink levels, one hairline between rows), and filled with real
 * `mayaProfile` fields rather than invented ones. That is exactly what Stripe does: its diagram
 * is a redraw of the real dashboard, not an abstraction of it. The test suite pins the grammar
 * so a future edit cannot quietly let it drift back into linework.
 *
 * ## What is deliberately NOT here
 *
 *   · **No `position: sticky`, and no scroll-driven anything.** The survey's runner-up was
 *     HiHello's sticky companion — genuinely the strongest way to show "their page is your
 *     card, live" — and it is declined twice over: `pinned-sequence.tsx` was deleted from this
 *     repo once already and `tests/unit/marketing-solution.test.tsx` now asserts `sticky`
 *     appears in neither of the adjacent section's files, and the CSS `animation-timeline`
 *     route that would avoid a client boundary is not Baseline (Firefox still has it behind a
 *     flag). Reintroducing a mechanism this codebase removed deserves a decision, not a commit.
 *   · **No lede paragraph**, which the survey says is what lets each step stay terse — Stripe
 *     and Cal.com both run one between the heading and the steps. `howItWorks` carries no such
 *     string and inventing brand copy is not this file's call; flagged for the fixture's owner.
 */

/** How many of the fixture's steps get a column of their own. See the header: the survey found
 *  three is the mode and five is shipped by nobody, and the two that move out are the two that
 *  are not actions. Derived as a slice rather than hardcoded ids, so the rail follows the
 *  fixture's own order if it is ever reordered. */
const RAIL_STEPS = 3;

/* ── the one geometry all three frames share ───────────────────────────────────────────
   Every frame is `--mk-steps-frame-h` tall (see the stylesheet) and every artefact inside one
   is the rigid 336×500 share face at a width chosen to sit inside that height with the frame's
   own padding — so nothing is ever cropped and the three columns end on one line by
   construction rather than by measurement.

   The deck's three faces are the SAME width as each other and smaller than the hero face, and
   they are offset diagonally by `DECK_STEP` so only the top card's content is read while the two
   beneath show as coloured edges. That is what says "cards, plural, in colours" without printing
   three field lists — the sin every fanned version of this step committed. */
/* ⚠ 240 / 200, NOT 252 / 212 — DERIVED, NOT TASTE. At the 64rem breakpoint a column is
   (1024 − 80 − 2×32) / 3 ≈ 293px. A frame must hold the wider of the hero face and the deck's
   face-plus-two-offsets, plus its own 22px side padding: 252 → 300px needed, which overflows
   by 7px at exactly the width the layout claims to fit — the same mistake that once shipped a
   79px horizontal scroll with a green suite. 240 / 200 need 288px. The unit test recomputes
   this from these constants, so moving any of them without moving the others fails loudly. */
const HERO_FACE_W = 240;
const DECK_FACE_W = 200;
const DECK_STEP = 22;

/** The three cards in step 02's deck, front to back. Work is the front card AND the face in
 *  step 03, so the object a reader watches get built is the object they watch get shared.
 *  The other two are ordered for palette contrast against Sapphire, not for content. */
const DECK_CARD_IDS = ["work", "family", "cv"] as const;

/** The fields the profile fragment draws, in the order it draws them. Real ids from
 *  `mayaProfile` — the same records every card in this section resolves through — so the panel
 *  is a redraw of real data rather than a mock-up of plausible data. All four of Maya's cities
 *  are here, as Maya Partners' four office lines in the map's order. */
const PROFILE_FIELD_IDS = [
  "field_job_title",
  "field_company",
  "field_mobile",
  "field_work_email",
  "field_london_office",
  "field_dubai_office",
  "field_new_york_office",
  "field_singapore_office",
] as const;

/**
 * ⚠ THESE FIVE ARE CHOSEN AGAINST THE CARD IN COLUMN 02, NOT AT RANDOM — 2026-09-22.
 *
 * A survey of how the best-regarded marketing sites explain a mechanism found the real defect
 * in this section, and it was not motion: **the three columns shared no object.** Linear's
 * hero works because one issue is visible at four stages of its life in a single frame — you
 * can see that the thing in the second panel is made of the thing in the first. This section
 * showed a profile, then some cards, then a QR: three different nouns, with a numbered rail
 * asserting a relationship the pictures never demonstrated.
 *
 * So the profile lists the fields that column 02's card *actually carries* — the "work"
 * card's role, company, mobile and work email — plus four it does not (the four office
 * lines). A reader can match the values on the left against the card beside it, row for row,
 * and see what did not make it. That is the filter claim and the continuity claim made at
 * once, statically, with no animation at all.
 *
 * ⚠ IF THAT CARD'S `fieldIds` EVER CHANGE, CHANGE THESE WITH THEM, or the two columns quietly
 * stop being the same person's data and the section goes back to being three nouns.
 */
/**
 * One drawn icon per field type.
 *
 * ⚠ THE DISCS WERE EMPTY BEFORE, AND THAT IS WHY THE PANEL READ AS A WIREFRAME. The product's
 * real rows carry an icon in that disc; this redraw carried a blank grey circle, five times,
 * which is the single clearest tell that a panel is a mock-up of a UI rather than a picture of
 * one. Keyed on `ProfileField["type"]` rather than on the field id, so a fixture that adds a
 * sixth field of a type already in this map gets its icon for free and one of an unmapped type
 * degrades to the generic mark instead of an empty hole.
 */
const FIELD_ICON: Record<string, LucideIcon> = {
  PHONE: Smartphone,
  LANDLINE: Phone,
  EMAIL: Mail,
  URL: Link2,
  JOB_TITLE: BriefcaseBusiness,
  COMPANY: Building2,
  ADDRESS: MapPin,
  SOCIAL_LINK: AtSign,
};

function fieldIcon(type: string): LucideIcon {
  return FIELD_ICON[type] ?? AtSign;
}

function exampleCard(id: string) {
  const spec = exampleCardSpecs.find((candidate) => candidate.id === id);
  if (!spec) throw new Error(`how-it-works: no example card fixture named "${id}"`);
  return spec.card;
}

function displayValue(field: ProfileField): string {
  return field.type === "PHONE" || field.type === "LANDLINE" ? formatPhoneDisplay(field.value) : field.value;
}

/**
 * Step 01's fragment — the profile, redrawn.
 *
 * ⚠ Drawn rather than rendered, and the header says why at length: the product's real profile
 * row is a client component with edit/reorder/delete handlers. What matters is that it is drawn
 * in the CARD's grammar, not in a second one — a 44px row, an icon disc on the left, the label
 * in the primary ink and the value in the quiet one, one hairline between rows. Placed beside
 * two real card renders it should read as the same system seen from the owner's side, which is
 * exactly what it is.
 *
 * The values come from `mayaProfile` untouched. Nothing here invents a phone number or an
 * address; `tests/contract/fixture-hygiene.test.ts` holds the fixtures to reserved domains.
 */
function ProfileFragment() {
  const fields = PROFILE_FIELD_IDS.map((id) => mayaProfile.fields.find((f) => f.id === id)).filter(
    (field): field is NonNullable<typeof field> => field !== undefined,
  );

  return (
    <div className="mk-steps-frame__body" data-steps-profile="">
      <p className="mk-steps-frame__label">{solution.profileLabel}</p>
      <ul className="mk-steps-profile__rows">
        {fields.map((field, index) => (
          <li
            key={field.id}
            className="mk-steps-profile__row"
            /* The row's own place in the one-shot stagger; the stylesheet reads it. */
            style={{ ["--mk-steps-row-i" as string]: index }}
          >
            <span aria-hidden="true" className="mk-steps-profile__disc">
              {(() => {
                const Icon = fieldIcon(field.type);
                return <Icon size={14} strokeWidth={1.75} />;
              })()}
            </span>
            <span className="mk-steps-profile__name">{field.label}</span>
            {/* A formatted number, never the stored E.164 column. */}
            <span className="mk-steps-profile__value">{displayValue(field)}</span>
          </li>
        ))}
      </ul>
      {/* The copy promises "anything custom you need"; an obviously-continuing list says that
          without adding a sixth row the window would only clip. */}
      <p className="mk-steps-profile__more">+ anything custom</p>
    </div>
  );
}

export function HowItWorks() {
  const steps = howItWorks.steps;
  const railSteps = steps.slice(0, RAIL_STEPS);
  const afterSteps = steps.slice(RAIL_STEPS);

  /* Resolved once each, against the page's one identity (`marketingUser`). */
  const deck = DECK_CARD_IDS.map((id) =>
    resolveCard(exampleCard(id), marketingUser, mayaProfile.groups, mayaProfile.fields),
  );
  const heroFace = deck[0]!;

  /**
   * One frame per rail step. All three are `.mk-steps-frame`; only the body differs. Every
   * artefact is the product's own `<ShareFace mode="thumb">` — the documented mode for a symbol
   * that is shown rather than scanned (`qr-zone.tsx`) — complete and uncropped, because there is
   * no frame in the world that makes a card cut off mid-address look intended.
   */
  function frameBody(index: number) {
    switch (index) {
      case 0:
        return <ProfileFragment />;

      case 1:
        return (
          <div className="mk-steps-frame__body" data-steps-deck="">
            <p className="mk-steps-frame__label">{solution.cardsLabel}</p>
            {/* A DECK, not a fan. Every fanned version of this step overlapped two cards' field
                lists and read as clutter; a deck offsets whole cards diagonally so the two behind
                contribute only an edge of their own colour. `--mk-steps-deck-i` drives both the
                offset and the deal order. Back-to-front in the DOM so the front card paints last
                without a z-index per card. */}
            <div
              className="mk-steps-deck"
              style={{
                ["--mk-steps-deck-w" as string]: `${DECK_FACE_W}px`,
                ["--mk-steps-deck-step" as string]: `${DECK_STEP}px`,
                ["--mk-steps-deck-n" as string]: deck.length,
              }}
            >
              {[...deck].reverse().map((card, i) => (
                <div
                  key={DECK_CARD_IDS[deck.length - 1 - i]}
                  className="mk-steps-deck__card"
                  style={{ ["--mk-steps-deck-i" as string]: deck.length - 1 - i }}
                >
                  <ShareFace resolved={card} mode="thumb" thumbWidth={DECK_FACE_W} />
                </div>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="mk-steps-frame__body" data-steps-share="">
            <p className="mk-steps-frame__label">Your link</p>
            <div className="mk-steps-hero-face">
              <ShareFace resolved={heroFace} mode="thumb" thumbWidth={HERO_FACE_W} />
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <Section id="how-it-works" tone="wash" labelledBy="how-it-works-heading">
      <SectionHead
        heading={accented(howItWorks.heading, howItWorks.accent)}
        headingId="how-it-works-heading"
      />

      <MkReveal move="rise" data-steps-rail="" className={HEAD_TO_BODY}>
        <ol className="mk-steps-rail">
          {railSteps.map((step, i) => (
            <li
              key={step.ordinal}
              className="mk-steps-item"
              style={{ ["--mk-steps-i" as string]: i }}
            >
              <div className="mk-steps-frame" aria-hidden="true">
                {frameBody(i)}
              </div>

              {/* The rail runs THROUGH the discs, between the picture and its words — which is
                  what ties the three together. It was a separate strip floating above the row
                  before, with the whole visual shelf between it and the text it was numbering,
                  and at that distance it read as unrelated furniture. Decorative: the ordinal
                  is printed in the disc for a sighted reader and the native `<ol>` carries the
                  position for everyone else. */}
              <div className="mk-steps-track" aria-hidden="true">
                {i > 0 ? <span data-edge="before" className="mk-steps-seg" /> : null}
                {i < railSteps.length - 1 ? (
                  <span data-edge="after" className="mk-steps-seg" />
                ) : null}
                {/* ⚠ THE STATIC NAVY SWATCH IS GONE, 2026-09-22, AND IT WAS REMOVED RATHER
                    THAN RETUNED. It permanently filled step 02's disc, to mark the step whose
                    copy claims a card takes a colour. With the walk below now filling each
                    disc in turn, a disc that is filled all the time reads as "this step is
                    always active" — two signals for one slot, which is the ambiguity the
                    client called confusing the last time this section animated. The claim it
                    carried is not lost: step 02's fragment is two cards in two palettes, which
                    says "give it a colour" far better than a 44px dot did. */}
                <span className="mk-steps-marker">
                  <span aria-hidden="true" className="mk-steps-marker__ring" />
                  <span className="mk-steps-marker__n tabular-nums">{step.ordinal}</span>
                </span>
              </div>

              <h3 className="mk-steps-title font-mk-display font-mk-editorial text-mk-ink">
                {step.title}
              </h3>
              <Prose className="mt-2 max-w-mk-measure">{step.body}</Prose>
            </li>
          ))}
        </ol>

        {/* ── the four cities ─────────────────────────────────────────────────────────────
            Its own band, in the frames' grammar, between the three actions and the two
            properties: it is about the profile in frame 01, so it sits directly under it. */}
        <WorldMap label={howItWorks.map.label} alt={howItWorks.map.alt} />

        {/* ── and then it stays true ──────────────────────────────────────────────────────
            The fixture's steps 04 and 05, kept word for word and moved out of the rail. They
            are not actions in a sequence — they are what remains true after the sequence — and
            the previous version's five equal columns said the opposite. No fragment: giving
            these a picture is what pushed the row to five columns and every visual to 205px.
            A hairline above, two columns, quieter type. */}
        {afterSteps.length > 0 ? (
          <ul className="mk-steps-after">
            {afterSteps.map((step, i) => (
              <li
                key={step.ordinal}
                className="mk-steps-after__item"
                style={{ ["--mk-steps-i" as string]: railSteps.length + i }}
              >
                <h3 className="mk-steps-after__title font-mk-display font-mk-editorial text-mk-ink">
                  {step.title}
                </h3>
                <Prose className="mt-1.5 max-w-mk-measure text-mk-stone">{step.body}</Prose>
              </li>
            ))}
          </ul>
        ) : null}
      </MkReveal>
    </Section>
  );
}
