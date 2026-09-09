import { resolveCard } from "@/card/resolve-card";
import { ShareFace } from "@/card/share-face";
import { FIXTURE_DB } from "@/fixtures";
import { exampleCards, exampleCardSpecs, marketingUser } from "@/fixtures/marketing";

import { MkReveal } from "./mk-reveal";
import { Section } from "./section";
import { accented, HEAD_TO_BODY, SectionHead, TextLink } from "./type";

/**
 * Brief Section 5 — the example cards.
 *
 * ## ⚠ THESE ARE THE PRODUCT'S OWN CARDS NOW, NOT TILES OF IT
 * The first cut of this section drew six coloured panels carrying a type name and three or four
 * field labels. They looked well but they were a *description* of the range, and the client's
 * note was that this section should show the card design itself — the wallet pass with its QR,
 * the one the dashboard already builds. So each cell is a real `<ShareFace>` resolved from a
 * real `ContactCard`, rendered by the product's own component. Nothing about the design is
 * re-drawn here, so nothing can drift.
 *
 * ## ⚠ SIX QR SYMBOLS ON A LANDING PAGE IS FREE, AND I CHECKED BEFORE BUILDING IT
 * `<QrZone>` takes no hooks and computes its symbol at module/render scope, so all six encodes
 * happen on the SERVER. The browser receives six inline SVG paths and does no encoding work at
 * all — which is why the objection that stopped this the first time (six `qrcode` encodes on
 * the page whose requirement is no perceptible lag) does not actually apply.
 *
 * ## ⚠ `mode="thumb"`, AND THE SYMBOLS HERE ARE DELIBERATELY NOT SCANNING TARGETS
 * A thumb scales the 336px design face into `THUMB_WIDTH`, which puts its symbol under
 * `MIN_QR_SIZE_PX` (140). That is correct for a grid: at 360px the content column is 312px
 * wide, so a full-size face would overflow it and scroll the page sideways — and a wall of six
 * scannable codes all pointing at the same demo card is not something a visitor wants aimed at
 * them. The hero shows one face at its full authored size; this section shows the range.
 *
 * ## One format, six colours, six different field sets
 * `templateId` is `meridian` on all six. Colour and CONTENT vary — "Limited" carries two fields
 * and "Business" carries six — because six palettes over one identical field list would say the
 * product is a colour picker. The brief's phrase "different cards with different designs"
 * invites six compositions and must not get them: someone handed one card should already know
 * where to look on every other.
 */

/**
 * The width each face is scaled into.
 *
 * 300, not 336: at a 360px viewport the content column is 312px wide (`px-6` each side), and
 * the face is rigid. 300 leaves 6px each side and never scrolls the page sideways — which is
 * the same constraint that fixed `FACE_WIDTH` at 336 for a 12px-padded card screen.
 */
const THUMB_WIDTH = 300;

export function ExampleCards() {
  const resolved = exampleCardSpecs.map((spec) => ({
    id: spec.id,
    name: spec.name,
    card: resolveCard(spec.card, marketingUser, FIXTURE_DB.groups, FIXTURE_DB.fields),
  }));

  return (
    <Section id="cards" tone="wash" labelledBy="cards-heading">
      {/* One accented phrase, via the shared helper so it carries `data-accent` and the spec's
          accent guard can see it — a hand-rolled `<span>` here is invisible to that rule. */}
      <SectionHead
        heading={accented(exampleCards.heading, exampleCards.accent)}
        headingId="cards-heading"
        lead={exampleCards.lead}
      />

      <div className={`${HEAD_TO_BODY} grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3`}>
        {resolved.map((entry, i) => (
          <MkReveal key={entry.id} index={i} move="rise">
            <figure data-example-card={entry.id} className="m-0 flex flex-col items-center gap-4">
              <ShareFace resolved={entry.card} mode="thumb" thumbWidth={THUMB_WIDTH} />
              {/* The name sits under the card rather than on it: the face has ONE format and a
                  section label printed inside it would be a seventh slot the format does not
                  have. `/templates` does the same. */}
              <figcaption className="font-mk-display text-mk-heading-sm font-mk-editorial text-mk-ink">
                {entry.name}
              </figcaption>
            </figure>
          </MkReveal>
        ))}
      </div>

      <p className="mt-12 text-mk-body">
        <TextLink href={exampleCards.more.href}>{exampleCards.more.label}</TextLink>
      </p>
    </Section>
  );
}
