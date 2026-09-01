import { resolveCard } from "@/card/resolve-card";
import { cardLedgerDemo, FIXTURE_DB } from "@/fixtures";
import { howItWorks } from "@/fixtures/marketing";

import { BentoCell, BentoGrid, BentoHead } from "./bento";
import { MkRevealGroup } from "./mk-reveal";
import { CardStudio } from "./card-studio";
import { ProfileExhibit, ReachExhibit, ScanExhibit } from "./demo-cells";
import { Section } from "./section";
import { HEAD_TO_BODY, SectionHead } from "./type";

/**
 * "How it works" — four steps, and **the pass where the product stops being described and
 * starts being shown.**
 *
 * ## Why this section was rebuilt and what it was
 * It was four columns of prose separated by hairlines: an ordinal, a title, three lines of copy,
 * four times. Everything about that construction was defensible in isolation and it was
 * precisely the thing the client named — *"just text, text, text and nothing else, with the
 * text being written in different dev boxes in different colors"*. The four steps had not
 * become wrong; they had never been illustrated. A page that says "make a card out of it" and
 * then does not show a card is asking to be believed about the one thing it could simply prove.
 *
 * So each step now carries the artefact it is talking about, and every one of those artefacts
 * is real:
 *
 *     01  Fill in your profile once   five real ProfileFields, through the product's own
 *                                     field registry, two of them masked by its own rule
 *     02  Make a card out of it       a live <ShareFace> and a live <CardPage>, recoloured
 *                                     by the nine card grounds, on press
 *     03  Hand it over                a <QrZone mode="full"> that genuinely decodes
 *     04  Send the update             a drawn fan — the one step with nothing to mount
 *
 * ⚠ **There is no stock photography here and none may be added.** Current practice on
 * product-led pages is a real screenshot or an interactive demo, never an illustration of one
 * and never a photograph of a person holding a phone; the brief's own words are *"make it real,
 * not AI-made"*, and a purchased image of a smiling stranger is the fastest way to make a page
 * read as generated. The product is the imagery. It is also better imagery than anything that
 * could be bought, because it is the thing being sold.
 *
 * ## The ordinals survived the rebuild, and they had to
 * A row of "01 / 02 / 03" bolted onto four unordered features is the oldest filler on the web,
 * and it is decoration there because the items do not depend on each other. Here they do — you
 * cannot hand a card over before you have made one — and the heading is a claim ABOUT the
 * sequence. So the order is still the information: the cells are in ordinal order in the DOM at
 * every viewport, and the `lg` placement below is explicit rather than automatic so the visual
 * order cannot drift away from the reading order.
 *
 * ⚠ It is deliberately **not** an `<ol>` any more, and that is a downgrade taken knowingly. A
 * list role promises that its items are peers of one kind; these four cells are a data table, a
 * pair of live product renders, a scannable target and a diagram, three of which contain their
 * own headings and one of which contains nine buttons. A screen reader announcing "list, 4
 * items" and then walking a reader into a group of nine colour controls has described the
 * structure inaccurately. The ordinals carry the sequence in text, where they always did most
 * of the work.
 *
 * ## ⚠ THE `lg` PLACEMENT IS A PINWHEEL, AND IT IS EXPLICIT ON PURPOSE
 *
 *     row 1   [ 01  cols 1-2 ][ 02  cols 3-6 ................ ]
 *     row 2   [ 03  cols 1-4 ................ ][ 04  cols 5-6 ]
 *
 * The narrow cell changes sides between the rows, and the ordinals still read left to right and
 * top to bottom. Three reasons that is worth writing out rather than leaving to auto-placement:
 *
 *   · A 2/4 row repeated twice is a **table**, and a reader recognises a repeated proportion as
 *     a template before reading a word. Mirroring it is the cheapest possible way to make the
 *     grid read as composed, and it costs four utilities.
 *   · ⚠ **The mirror must not invert the reading order**, which is the trap this arrangement
 *     was rebuilt to avoid. Putting the narrow cell on the right of row 2 while keeping DOM
 *     order would have printed 01 · 02 on the first line and 04 · 03 on the second — a numbered
 *     sequence a reader scans backwards. The wide cell in row 2 is therefore 03, not 04, and
 *     the cells' own content decided which way round: the scan cell wants width for its symbol
 *     to sit beside its copy, and the fan is a small drawing.
 *   · Auto-placement never backtracks, so the layout would otherwise depend on the order and
 *     the span of every cell before it — add a fifth cell and the whole grid rearranges
 *     silently. Explicit `col-start` plus `row-start` is placement that survives editing.
 *
 * ## Six columns, and why not four or five
 * Six is the smallest count that gives a 2/4 split and a mirrored 4/2 with whole tracks, which
 * is what the pinwheel needs. Below `lg` there is no second column at all — see the ⚠ on
 * `BentoGrid` for why a two-column middle stage produces holes rather than a tablet layout.
 *
 * ## The pass is still the only object with depth
 * `<Section>` owns the radius, the ground and the two-layer shadow. A bento cell carries a
 * ground, a radius and a hairline and never a shadow — see the ⚠ in `bento.tsx` for why that
 * is a reading of DESIGN.md's rule rather than a breach of it.
 *
 * ## The one card on the page is now four objects, and the rule it replaces
 * The previous direction allowed exactly one card on `/`, in the hero film, because the build
 * before it had spread nine `<ShareFace>` renders across the page as decoration. That rule was
 * solving the right problem with the wrong instrument: the defect was nine *identical*
 * thumbnails used as wallpaper, not the presence of the product. Every card object below is
 * doing a job no sentence could do — one is recoloured by the reader, one is cropped to show
 * that it keeps going, and one carries a symbol a phone can read off the screen.
 */
export function StepList() {
  /*
    Resolved once, on the server, from the fixture gateway — the only data source in the
    application. `cardLedgerDemo` is the card §6.7's vCard example is written against: five
    mapped fields, slug `prya-hq`, and no `paletteId` of its own, so it wears its template's
    default and the studio opens on Sapphire.

    ⚠ The SAME resolved card feeds the studio and the QR, and that is the point rather than a
    saving. The symbol in cell 03 encodes `/c/prya-hq`, which is the card rendered in cell 02.
    Two different fixtures would give the page a QR that opens a card the reader has not been
    shown, which is a small lie in the one place the page is inviting them to check it.
  */
  const resolved = resolveCard(cardLedgerDemo, FIXTURE_DB.user, FIXTURE_DB.groups, FIXTURE_DB.fields);
  const [profile, card, hand, update] = howItWorks.steps;

  return (
    <Section id="how-it-works" tone="paper" labelledBy="how-it-works-heading">
      <SectionHead heading={howItWorks.heading} headingId="how-it-works-heading" />

      {/* One observer stages all four cells. `MkRevealGroup` renders `display: contents`, so the
          grid still sees the cells as its own direct children and the placement is untouched —
          and the cells themselves stay server components. See its header for why the finished
          state is the default rather than the animated one. */}
      <MkRevealGroup>
      <BentoGrid className={HEAD_TO_BODY}>
        {/* 01 — the profile. Narrow, left, row one. */}
        <BentoCell
          id="profile"
          tone="white"
          span="lg:col-span-2 lg:col-start-1 lg:row-start-1"
        >
          <BentoHead ordinal={profile.ordinal} title={profile.title} body={profile.body} />
          <ProfileExhibit />
        </BentoCell>

        {/* 02 — the studio. The widest cell, and the only interactive one on the page. */}
        <BentoCell
          id="studio"
          tone="white"
          span="lg:col-span-4 lg:col-start-3 lg:row-start-1"
        >
          <BentoHead ordinal={card.ordinal} title={card.title} body={card.body} />
          <CardStudio resolved={resolved} initialPaletteId={resolved.palette.id} />
        </BentoCell>

        {/*
          03 — the scan. Onyx, because the QR plate is an opaque white rectangle and a white
          plate on a white cell has no edge; see `demo-cells.tsx`. It is also the only dark
          surface between the hero and the close, which is worth having in the middle of a
          stack of light passes — and it is the wide cell of the second row, which is what
          keeps the four ordinals reading left to right.
        */}
        <BentoCell
          id="scan"
          tone="ink"
          span="lg:col-span-4 lg:col-start-1 lg:row-start-2"
        >
          <BentoHead ordinal={hand.ordinal} title={hand.title} body={hand.body} onInk />
          <ScanExhibit resolved={resolved} />
        </BentoCell>

        {/*
          04 — the update. `tone="quiet"` is an outline on the pass's own paper, and it is the
          narrow cell: the one step with nothing to mount gets the smallest, lightest box on the
          grid, so the layout's weight follows the evidence rather than being handed out evenly.

          `accent` marks the ordinal in the lifted Emerald — the page's one annotation colour,
          4.52:1 on paper — because the heading above the grid says you only repeat the last
          one and the type only has to point at which. It is not the action colour and must not
          become it: Amber at a level legal for text on paper is a dark ochre that reads as
          neither.
        */}
        <BentoCell
          id="reach"
          tone="quiet"
          span="lg:col-span-2 lg:col-start-5 lg:row-start-2"
        >
          <BentoHead
            ordinal={update.ordinal}
            title={update.title}
            body={update.body}
            accent
          />
          <ReachExhibit />
        </BentoCell>
      </BentoGrid>
      </MkRevealGroup>
    </Section>
  );
}
