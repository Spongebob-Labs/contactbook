import type { ReactElement, ReactNode } from "react";

import { formatPhoneDisplay } from "@/lib/format";
import { heroPhone, howItWorks, mayaProfile, solution, type HeroPhoneIcon } from "@/fixtures/marketing";
import type { ProfileField } from "@/types/domain";

import { BrandCard, type BrandCardCover } from "./brand-card";
import { brandCardContent } from "./brand-card-content";
import { ROW_GLYPHS } from "./hero-phone-glyphs";
import { MkReveal } from "./mk-reveal";
import { Section } from "./section";
import { accented, HEAD_TO_BODY, Prose, SectionHead } from "./type";
import { WalletPass, walletPassContent } from "./wallet-pass";
import { WorldMap } from "./world-map";

/**
 * Section 4 — how it works.
 *
 * ## ⚠ 2026-10-06 (LATER) — ONE ROW OF FOUR, FOUR IDENTICAL FRAMES, ONE OBJECT PER FRAME
 *
 * The client saw the first four-step build and called it *"very big, a lot of dirt in the UI"*.
 * Measured, every complaint was real: step 04 wrapped onto a second row under a three-column grid;
 * frame 01 was taller than the rest; frame 02 was a deck of three overlapping cards clipped by
 * the frame, whose back cards showed as black and peach slivers; frame 03's link line ran past the
 * card's edge; and frame 03 showed the in-app card where the product actually hands over an Apple
 * Wallet pass. So:
 *
 *   1. **One row of four from 64rem (1024px)**, a 2×2 grid from 48rem, a stack below. The four
 *      columns share subgrid rows (`marketing-steps.css`), so titles, bodies and frames line up
 *      across the row whatever each body's length.
 *   2. **Four identical frames.** One class, one height — derived from the card's zoom, so it
 *      cannot drift from what it holds — and inside each, one label and one window.
 *   3. **One object per frame, never a stack.** 02 is the Work card (the hero card's design,
 *      `BrandCard`) with the fields chosen for it; 03 is the Apple Wallet pass the API signs for
 *      that same card (`wallet-pass.tsx`); 04 is the same card again with one field changed and
 *      marked "Updated". Every card is zoomed uniformly by `--mk-steps-zoom` to fit its column,
 *      as the hero's card is, and the one crop is the window's own, at the foot, with a fade.
 *   4. **Panel 01 is shorter**: six rows of Maya's profile (four the card carries, two it does
 *      not — her home city and the London office), set as label over value so nothing is cut mid-word in a narrow column.
 *
 * The client's copy is unchanged: four titles and bodies, each above its frame.
 *
 * ## The rules this section's history paid for (builds 1–6, 2026-09-21 → 10-06)
 *
 *   · **Identical frames, one shared object.** Unlike objects in identical columns never cohere;
 *     the Work card is the object, seen as built (02), as handed over (03) and as updated (04).
 *   · **Crop, never shrink below legibility.** The zoom is chosen per breakpoint from the column
 *     width (`tests/unit/marketing-steps.test.tsx` recomputes it) and is the same in every frame.
 *   · **No deck, no fan.** Both overlapped content; both were rejected.
 *   · **One construction per row.** Panel 01 is a list — no server-safe profile renderer exists —
 *     drawn in the card's grammar: its icon chips are the brand card's own glyphs.
 *   · **Nothing loops.** One entrance keyed on the rail's own scroll-in (`data-mk-reveal="in"`):
 *     rows, then the cards land, then the updated row lights — once, about 1.5s. WCAG 2.2.2 never
 *     applies.
 *   · **No `position: sticky`**, and no scroll-driven anything.
 *
 * The full account of each rejected build is in this file's git history.
 */

/** Frame 01's rows: real `mayaProfile` records. Four are on the Work card (role, company, mobile,
 *  work email); her home city and the London office line are not — the filter, made visible. */
const PROFILE_FIELD_IDS = [
  "field_job_title",
  "field_company",
  "field_mobile",
  "field_work_email",
  "field_home_address",
  "field_london_office",
] as const;

/** The card's own glyph for each profile field type, so frame 01's chips match the card's. */
const FIELD_GLYPH: Readonly<Record<string, HeroPhoneIcon>> = {
  PHONE: "phone",
  LANDLINE: "phone",
  EMAIL: "mail",
  URL: "link",
  SOCIAL_LINK: "link",
  JOB_TITLE: "briefcase",
  COMPANY: "building",
  ADDRESS: "pin",
};

/** The one card every card frame shows. */
export const SHARED_CARD_ID = "work";

/**
 * The card's design width. Every frame's window is `CARD_WINDOW_H` design px tall at the
 * stylesheet's `--mk-steps-zoom`, and the stylesheet's own constants carry the same two numbers —
 * the unit test reads both and fails if they part.
 */
export const CARD_DESIGN_W = 330;
export const CARD_WINDOW_H = 600;

/** The hero card's own portrait — the Work card here IS that card. */
const PORTRAIT: BrandCardCover = { kind: "photo", x2: heroPhone.portrait.x2, x3: heroPhone.portrait.x3 };

function displayValue(field: ProfileField): string {
  return field.type === "PHONE" || field.type === "LANDLINE" ? formatPhoneDisplay(field.value) : field.value;
}

function ProfileRows(): ReactElement {
  const fields = PROFILE_FIELD_IDS.map((id) => mayaProfile.fields.find((f) => f.id === id)).filter(
    (field): field is NonNullable<typeof field> => field !== undefined,
  );
  return (
    <>
      <ul className="mk-steps-profile__rows">
        {fields.map((field, index) => (
          <li
            key={field.id}
            className="mk-steps-profile__row"
            style={{ ["--mk-steps-row-i" as string]: index }}
          >
            <span aria-hidden="true" className="mk-steps-profile__disc">
              {ROW_GLYPHS[FIELD_GLYPH[field.type] ?? "link"]}
            </span>
            <span className="mk-steps-profile__text">
              <span className="mk-steps-profile__name">{field.label}</span>
              {/* A formatted number, never the stored E.164 column. */}
              <span className="mk-steps-profile__value">{displayValue(field)}</span>
            </span>
          </li>
        ))}
      </ul>
      {/* The copy promises "anything custom you want"; an obviously-continuing list says it. */}
      <p className="mk-steps-profile__more">+ anything custom</p>
    </>
  );
}

/** The Work card's own colour, laid over the top of the portrait in frame 02 (the same tint the
 *  Solution deck's cards wear). */
const WORK_TINT = "var(--mk-sapphire)";

/**
 * Frame 02 — "Create your cards". Not another copy of the finished card: the designer's view of
 * making one. Three card tabs and a "+" (you can make as many as you want), the Work card below
 * in its own colour with only the fields chosen for it, then the two choices that make a card
 * yours — which fields go on it (four chips, on or off) and its colour (four swatches, one
 * ringed). All drawn, none live: the frame is `aria-hidden`, there are no inputs and nothing
 * answers a hover.
 */
function CardDesigner(): ReactElement {
  const work = solution.cards.find((c) => c.id === SHARED_CARD_ID);
  const chips = howItWorks.design.fieldIds.map((id) => ({
    id,
    label: solution.profile.find((f) => f.id === id)?.label ?? id,
    on: (work?.fields as readonly string[] | undefined)?.includes(id) ?? false,
  }));
  return (
    <div className="mk-steps-design" data-steps-designer="">
      <div className="mk-steps-design__tabs">
        {solution.cards.map((card) => (
          <span
            key={card.id}
            className="mk-steps-tab"
            {...(card.id === SHARED_CARD_ID ? { "data-active": "" } : {})}
          >
            {card.name}
          </span>
        ))}
        <span className="mk-steps-tab mk-steps-tab--add">{howItWorks.design.addTab}</span>
      </div>
      <div className="mk-steps-design__stage">
        <BrandCard
          layout="flow"
          cover={{ kind: "photo", x2: heroPhone.portrait.x2, x3: heroPhone.portrait.x3, tint: WORK_TINT }}
          idPrefix="mk-steps-card"
          className="mk-steps-card"
          cardAttributes={{ "data-card-id": SHARED_CARD_ID }}
          {...brandCardContent(SHARED_CARD_ID)}
        />
      </div>
      <div className="mk-steps-design__tools">
        <div className="mk-steps-swatches">
          {howItWorks.design.palettes.map((palette, i) => (
            <span
              key={palette.id}
              className="mk-steps-swatch"
              style={{ ["--mk-steps-swatch" as string]: palette.colour }}
              {...(i === 0 ? { "data-active": "" } : {})}
            />
          ))}
        </div>
        <div className="mk-steps-fchips">
          {chips.map((chip) => (
            <span key={chip.id} className="mk-steps-fchip" {...(chip.on ? { "data-on": "" } : {})}>
              {chip.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The brand card, flowed, at the frames' one zoom (set by the stylesheet, not inline). */
function PanelCard({
  idPrefix,
  update,
}: {
  idPrefix: string;
  update?: boolean;
}): ReactElement {
  return (
    <BrandCard
      layout="flow"
      cover={PORTRAIT}
      idPrefix={idPrefix}
      className="mk-steps-card"
      cardAttributes={{ "data-card-id": SHARED_CARD_ID }}
      updatedLabel={howItWorks.update.mark}
      {...brandCardContent(
        SHARED_CARD_ID,
        update ? { update: { field: howItWorks.update.field, value: howItWorks.update.value } } : {},
      )}
    />
  );
}

/** One frame: the same class, the same label, the same window, every time. */
function Frame({
  label,
  hook,
  children,
}: {
  label: string;
  hook: "profile" | "card" | "pass" | "update";
  children: ReactNode;
}): ReactElement {
  return (
    <div className="mk-steps-frame" aria-hidden="true">
      <div className="mk-steps-frame__body" {...{ [`data-steps-${hook}`]: "" }}>
        <p className="mk-steps-frame__label">{label}</p>
        <div className="mk-steps-window">{children}</div>
      </div>
    </div>
  );
}

function frameFor(index: number): ReactElement | null {
  switch (index) {
    case 0:
      return (
        <Frame label={howItWorks.panels.profile} hook="profile">
          <ProfileRows />
        </Frame>
      );
    case 1:
      return (
        <Frame label={howItWorks.panels.card} hook="card">
          <CardDesigner />
        </Frame>
      );
    case 2:
      return (
        <Frame label={howItWorks.panels.pass} hook="pass">
          <WalletPass content={walletPassContent(SHARED_CARD_ID)} />
        </Frame>
      );
    case 3:
      return (
        <Frame label={howItWorks.panels.update} hook="update">
          <PanelCard idPrefix="mk-steps-update" update />
          {/* The update arriving on the recipient's side: a banner over the card's cover. */}
          <p className="mk-steps-toast">
            <span aria-hidden="true" className="mk-steps-toast__dot" />
            {howItWorks.update.toast}
          </p>
        </Frame>
      );
    default:
      return null;
  }
}

export function HowItWorks(): ReactElement {
  const steps = howItWorks.steps;

  return (
    <Section id="how-it-works" tone="wash" labelledBy="how-it-works-heading">
      <SectionHead
        heading={accented(howItWorks.heading, howItWorks.accent)}
        headingId="how-it-works-heading"
      />
      <MkReveal move="rise" data-steps-rail="" className={HEAD_TO_BODY}>
        <ol className="mk-steps-rail">
          {steps.map((step, i) => (
            <li
              key={step.ordinal}
              className="mk-steps-item"
              style={{ ["--mk-steps-i" as string]: i }}
            >
              {/* The rail runs along the top through the disc that numbers each column.
                  Decorative: the native `<ol>` carries the position. Each segment reaches half
                  the gap toward its neighbour, and the outer ends draw nothing, so nothing
                  dangles after 04. */}
              <div className="mk-steps-track" aria-hidden="true">
                {i > 0 ? <span data-edge="before" className="mk-steps-seg" /> : null}
                {i < steps.length - 1 ? <span data-edge="after" className="mk-steps-seg" /> : null}
                <span className="mk-steps-marker">
                  <span aria-hidden="true" className="mk-steps-marker__ring" />
                  <span className="mk-steps-marker__n tabular-nums">{step.ordinal}</span>
                </span>
              </div>
              <h3 className="mk-steps-title font-mk-display font-mk-editorial text-mk-ink">
                {step.title}
              </h3>
              <Prose className="mk-steps-body max-w-mk-measure">{step.body}</Prose>
              {frameFor(i)}
            </li>
          ))}
        </ol>
        {/* ── the globe ───────────────────────────────────────────────────────────────────
            Its own band, in the frames' grammar, under the steps. */}
        <WorldMap label={howItWorks.map.label} alt={howItWorks.map.alt} />
      </MkReveal>
    </Section>
  );
}
