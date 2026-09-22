import Link from "next/link";

import type { TemplatePalette } from "@/card/template-palettes";
import { cardSwatch } from "@/card/card-palette";
import { Badge } from "@/components/primitives";
import type { Attention } from "@/lib/dashboard/metrics";

/**
 * The four states worth acting on, worst first.
 *
 * ## Why this replaced "Recent contacts"
 * A reverse-chronological list of names answers no question. The owner added those contacts —
 * seeing them again on the dashboard tells them nothing they can do anything about, and it was
 * the largest block on the screen. Every row here has an action attached and a link to the
 * screen where the action lives, which is what earns space on a dashboard.
 *
 * A card in good standing produces **no row**. An empty list is the healthy state and says so.
 *
 * ## Why the rows are drawn as a queue rather than as prose
 *
 * This is the product's real action list, and it shipped as four grey sentences of identical
 * weight. Everything a reader needs in order to triage — *which card*, *how bad*, *what to do* —
 * was carried by one run of text at one size, so the only way to find the worst row was to read
 * every row. `attention()` already sorts worst-first and already labels each kind; the list was
 * throwing both away at render time.
 *
 * Each row now resolves into three fixed positions, in the order a reader actually asks for them:
 *
 *   `│`  a rule in **the card's own colour** — which card, before any reading happens
 *   `Name  [Word]` — which card, and how bad, on one line
 *   `sentence` — what is wrong, in the copy below, unchanged
 *
 * The three sit in the same place on every row, so the eye can run down one column at a time.
 * That is the whole difference between a queue and a paragraph.
 *
 * ## The colour: the app's own ladder, and the two things on this list that stay off it
 *
 * This list used to be painted from a `--dash-*` mint scoped to `/dashboard`. The client
 * removed it on 2026-09-20 — cream and beige, uniform with every other screen — so the list now
 * draws **straight onto `--canvas`**, with no panel of its own under it. Every ratio quoted
 * below was RE-MEASURED against the cream grounds with `src/lib/contrast.ts`. None of them is a
 * mint number with a new token name pasted in front of it; several moved.
 *
 * ⚠ **The argument that kept the app's neutrals out was temperature, and it inverts on cream.**
 * `--ink-3` (`#816544`) and `--line` (`#E8E2DC`) are Atelier *warm*, and the case against them
 * was never contrast — both cleared their floors on mint. It was that a gold-brown label on a
 * cool ground reads as a stain on the ground rather than as a label sitting on it. On this
 * ground the reverse holds, and better than "warm on warm": `--ink-3` is the token `tokens.css`
 * derives against these exact grounds, sized by `--surface-sunk` because that is the worst one
 * in the system. The list is back on the ladder the rest of the app is measured on, which is
 * also why nothing below needed a new value invented for it.
 *
 *   heading · count               `text-ink-3`       5.20 on --canvas (1.4.3)
 *   row sentences                 `text-ink-3`       5.20 at rest, 4.87 on the hover band
 *   row dividers                  `border-line`      1.23 on --canvas (decorative — see below)
 *   hover / focus band            `bg-surface`       1.07 against the page — see the row comment
 *   all-clear panel               `bg-surface-sunk` + `border-line` + `text-ink-3`   4.55
 *
 * The divider gets marginally *louder* rather than quieter in the move, which is the point:
 * mint `--dash-line` measured 1.22 on its own wash and `--line` measures **1.23** on `--canvas`,
 * the ground it was sized against in the first place. Both are held to "visible", not to 3:1 —
 * a divider carries no information that the row's own geometry does not already carry.
 *
 * ⚠ **The ladder is still split by threshold and the steps are still not interchangeable.**
 * `--ink-3` is the 4.5:1 TEXT step and appears here only as text; `--surface`/`--surface-sunk`
 * are grounds and appear only as fills; `--line-control` is the 3:1 GRAPHICAL step and appears
 * exactly once, as the palette-less marker fallback — see {@link NO_CARD_COLOUR}. Promoting a
 * ground to text or a boundary colour to a label is how a recolour quietly ships 1.07:1 body
 * copy, and it is the specific mistake this list is laid out to make hard.
 *
 * The two things that stay off the chrome ladder entirely are the marker column and the warning
 * chips. Both are argued where they are drawn — see {@link NO_CARD_COLOUR}, {@link markerStyle}
 * and the note above `<Badge>` in the row.
 */

/**
 * The per-kind copy. **Deliberately unchanged** — the tone split is a claim about the data,
 * not a style choice.
 *
 * `no-fields` and `behind` are `warning` because the owner has to *do* something: an empty card
 * shares nothing at all, and a recipient who has not been told about a change is holding a link
 * to a card they think they already know. `never-opened` and `never-shared` are `neutral`
 * because neither is a fault — nobody is obliged to open a link, and a card can legitimately be
 * waiting for its first share. Flattening those four into one alarm colour, or promoting the two
 * quiet ones to make the list look busier, would make the list lie about which rows matter.
 *
 * ⚠ **Every label is a word, and that is load-bearing, not incidental.** `PRODUCT.md`: "Status
 * is never carried by colour alone." The `warning` badge's amber wash and the `neutral` badge's
 * grey are the *second* encoding; "Empty" / "Not told" / "Unopened" / "Unshared" are the first,
 * and they survive greyscale, a monochrome display and every form of colour blindness. A badge
 * added here without text would regress that, however obvious its hue looks on this monitor.
 *
 * ⚠ The recolour does not reach this map, and must not. Cream is the *resting* colour of the
 * app — it is chrome, it means "this is ContactBook", and it carries no severity. Amber means
 * "act on this". A beige warning would be a warning that says nothing, and the failure is
 * sharper now than it was under mint: a severity scale drawn from the chrome ladder would sit
 * on the chrome itself at 1.07:1 and simply not be there.
 */
const COPY: Record<Attention["kind"], { tone: "warning" | "neutral"; label: string; say: (n: number) => string }> = {
  "no-fields": {
    tone: "warning",
    label: "Empty",
    say: () => "Shares nothing — anyone who scans it gets only your name.",
  },
  behind: {
    tone: "warning",
    label: "Not told",
    say: (n) => `${n} ${n === 1 ? "recipient hasn't" : "recipients haven't"} been told it changed.`,
  },
  "never-opened": {
    tone: "neutral",
    label: "Unopened",
    say: (n) => `${n} ${n === 1 ? "person hasn't" : "people haven't"} opened their link yet.`,
  },
  "never-shared": {
    tone: "neutral",
    label: "Unshared",
    say: () => "Nobody has this card yet.",
  },
};

/**
 * The rule's colour when this list is rendered without palettes — a neutral control boundary,
 * never `--line` (1.23:1 on the canvas, a hairline that vanishes at this width and would read
 * as a rendering fault rather than as a deliberate blank).
 *
 * `palettes` is optional, so every caller that predates it keeps working and simply gets a set
 * of grey rules: the list is still a correct, complete queue without card colour, because the
 * colour is an *accelerator* for finding a row, not the thing that identifies it. The card's
 * name, one pixel-column to the right, is what identifies it.
 *
 * ⚠ **It stayed `--line-control` while the mint was painted around it, and it stays now that
 * the mint is gone.** Two reasons, and the second is measured:
 *
 *   1. *Meaning.* This value means "this card has no colour". Painting the blank in any chrome
 *      accent would make a palette-less card look like a card whose colour happens to be the
 *      house one — the reading the fallback must never produce, since the marker column exists
 *      to tell cards apart. A neutral grey says "absent"; a hue says "this one".
 *   2. *Numbers.* `--line-control` holds **3.77** on `--canvas` and **3.53** on the hover band,
 *      so the blank rule clears 1.4.11's 3:1 on every ground this list is drawn on — and with
 *      more headroom than it had on mint, where the same two figures were 3.60 and 3.39. It is
 *      also the app's own designated control-edge token rather than a value borrowed from a
 *      screen-local palette, which is what makes it survive the next direction change.
 */
const NO_CARD_COLOUR = "var(--line-control)";

/**
 * ⚠ **`canvasActionBg`, never `ground`.**
 *
 * These rules are drawn on the app canvas, and card grounds come in two tiers. The light
 * tier is light enough to be invisible there — Pistachio's `#BFD48C` measures about **1.6:1** on
 * `#FFFFFF`, so half the palettes would contribute a rule the reader cannot see and the marker
 * would silently stop working for exactly the cards it was added to distinguish. That is also
 * below WCAG 1.4.11's 3:1 floor for a meaningful graphical object.
 *
 * `canvasActionBg` is the slot that exists for precisely this: a card's colour drawn on the app
 * canvas. `PALETTE_CONTRACT` in `src/card/template-palettes.ts` asserts it clears both 3:1 (as a
 * fill) and 4.5:1 (as text) against `#FFFFFF` on **every** palette, so a future palette with a
 * near-white ground fails a test here rather than shipping an invisible rule.
 *
 * ⚠ **The ground under these rules is not white, and the recolour still leaves them alone.**
 * They sit on `--canvas`, and on `--surface` while a row is hovered. `PALETTE_CONTRACT` proves
 * the edge against `#FFFFFF`, so the cream grounds were re-measured rather than assumed: across
 * all eleven palettes the edge's **worst** case is **5.41** on `--canvas` and **5.06** on the
 * hover band — Mint's `#0C7560`, the lightest `canvasActionBg` in the set — against a 3:1 floor.
 * Cream is a shade off white, so the contract carries over with room to spare, which is the
 * whole reason this function is untouched by a change that repainted everything around it. The
 * card colour is the one thing in this list that is not app chrome, and `tests/unit/
 * dashboard-card-colour.test.tsx` holds it to agreeing with the same card's bar in the reach
 * chart.
 *
 * A missing `cardId` falls back rather than throwing, for the same reason `cardPalette()` does:
 * a bad id should cost a grey rule on the owner's own dashboard, never a thrown error that takes
 * the whole screen down with it.
 */
function markerStyle(
  palettes: ReadonlyMap<string, TemplatePalette> | undefined,
  cardId: string,
): { backgroundColor: string; boxShadow?: string } {
  const palette = palettes?.get(cardId);
  if (palette === undefined) return { backgroundColor: NO_CARD_COLOUR };

  /* ⚠ `cardSwatch` rather than `canvasActionBg` directly, and the bug it closes is a real one
     this list shipped: the reach bars a few rows up fill with the card's `ground`, so a
     Marigold card read as ochre there and as deep brown here — one card, two colours, on one
     screen. The rule now lives in `cardSwatch` and both components read it.

     An INSET shadow rather than a border: the rule is 6px wide, and a real border would eat
     two of those six and leave the edge dominating the fill it is meant to frame. */
  const { fill, edge } = cardSwatch(palette);
  return { backgroundColor: fill, boxShadow: `inset 0 0 0 1px ${edge}` };
}

export interface AttentionListProps {
  rows: readonly Attention[];
  /**
   * `cardId` → the colour that card actually wears, derived once by the dashboard and shared
   * with the reach bars and the featured tile so all three agree.
   *
   * **Optional on purpose.** Callers and tests that only have `rows` must keep compiling and
   * keep rendering a usable list; see {@link NO_CARD_COLOUR}.
   */
  palettes?: ReadonlyMap<string, TemplatePalette>;
}

/**
 * ⚠ **The queue is capped, and the cap is a content decision rather than a layout one.**
 *
 * `attention()` returns one row per problem per card and has no limit. On a nine-card profile
 * with nothing shared that is nine rows, eight of them the identical sentence "Nobody has this
 * card yet" — one fact, restated until it fills the page and pushes everything beside it into
 * dead space. Found by screenshotting the real screen; a two-card fixture never shows it.
 *
 * Five is the floor at which the list still reads as a *queue* — enough rows to show that the
 * items differ in kind (empty · unshared · not told), few enough that the eye takes the whole
 * thing at once. The remainder is not hidden: the count beside the heading still states the true
 * total, and the footer names what is left and links to the screen that can act on all of it.
 */
const MAX_ROWS = 5;

export function AttentionList({ rows, palettes }: AttentionListProps) {
  const shown = rows.slice(0, MAX_ROWS);
  const hidden = rows.length - shown.length;

  return (
    <section data-dashboard-region="attention" aria-labelledby="attention-heading">
      {/* The count sits beside the heading rather than inside it: a heading's accessible name
          is read on every landmark jump, and "Needs attention 3 things to do" is a worse name
          than "Needs attention" for a number that changes on every load. Visually it is the
          cheapest possible triage signal — the reader learns the size of the queue before
          reading a single row.

          Both are `--ink-3` rather than `--ink` or `--ink-2`: they are the list's own chrome,
          they name the region rather than reporting on any one card, and `--ink-3` is the
          system's label-and-caption step. At **5.20** on `--canvas` the overline clears 1.4.3
          as small text with room to spare; neither sits on the hover band, so `--canvas` is the
          only ground either has to be measured against. The count keeps `tabular-nums` — the
          colour changed, the digit metrics did not. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="attention-heading" className="text-overline uppercase text-ink-3">
          Needs attention
        </h2>
        {rows.length === 0 ? null : (
          <p className="text-sm text-ink-3 tabular-nums">
            {rows.length} {rows.length === 1 ? "thing" : "things"} to do
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        /* The healthy state is a statement, not an absence. An empty region with nothing in it
           reads as a component that failed to load; a bordered panel that names all three
           conditions reads as a check that ran and passed. `data-attention-clear` is the handle
           that distinguishes "clear" from "not rendered" for anything asserting on this screen.

           `--surface-sunk` is the app's own well — `tokens.css` gives it "sidebar, wells, table
           zebra" — which is exactly the reading the mint `--dash-track` was borrowed for and the
           right note for this panel: it only appears when there is nothing to do, so a fill that
           sits *below* the page rather than above it is the honest depth. **1.14** against
           `--canvas`, present without becoming a selected state.

           `--ink-3` on it measures **4.55**, which clears 4.5 with very little room, and that is
           by construction rather than by luck: `tokens.css` sizes `--ink-3` against
           `--surface-sunk` precisely because it is the worst ground in the system. So this is
           the deepest fill the copy can sit on — a step past `--surface-sunk` and the text would
           have to become `--ink-2` (9.60 there, but near-black and heavier than an all-clear
           deserves). */
        <p
          data-attention-clear=""
          className="mt-5 rounded-lg border border-line bg-surface-sunk px-4 py-3 text-sm text-ink-3"
        >
          Nothing to do — every card has fields, everyone who has one has opened it, and no
          recipient is behind on a change.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col">
          {shown.map((row) => {
            const copy = COPY[row.kind];
            return (
              <li
                key={`${row.kind}:${row.cardId}`}
                data-attention-row={row.kind}
                /* Exposed so a sweep can assert the severity encoding without scraping class
                   names, which change whenever the design does. */
                data-attention-tone={copy.tone}
                /* The band, and the four things it had to satisfy.
                   · **Depth.** `--surface` is the one fill the ladder offers between `--canvas`
                     and a ground that carries white text. It reads as a response (**1.07**
                     against the page — slight, but present over a band this wide) without
                     becoming a selected state, and it keeps the sentence at **4.87** and the
                     lightest card marker edge at **5.06**, both comfortably over their floors.
                   · ⚠ **Not `--surface-sunk`, and the `neutral` chip is the whole reason.**
                     `Badge` draws its `neutral` tone as `bg-surface-sunk`, so a `--surface-sunk`
                     band would lay that chip's fill on an identical fill — **1.00**, a chip that
                     dissolves at the exact moment the pointer lands on the row it belongs to,
                     leaving four words floating with no shape around them. On `--surface` the
                     chip holds **1.07**, the same separation it has against the page at rest.
                     The deeper well is still right where nothing sits on it — the all-clear
                     panel above, and the chart's quiet band — which is why one mint token
                     becomes two cream ones here rather than one.
                   · **Keyboard parity.** `focus-within` as well as `hover`, because the row
                     contains a link and a keyboard reader deserves the same "you are here" the
                     pointer gets. The global `:focus-visible` ring is untouched and still does
                     the actual focus indication; this only tints the row around it.
                   · **360px.** `-mx-2 px-2` bleeds the band 8px past the text column into the
                     shell's 12px gutter, so it reads as a band across the row rather than as a
                     box drawn tight around the words, and 4px of gutter still remains — it
                     cannot start a horizontal scroll. The divider shares those edges, which is
                     why it now runs slightly wider than the heading above it.
                   `--dur-fast` and `ease-out` are the house transition; both respect the
                   reduced-motion override in `globals.css`, which a hard-coded duration
                   would not. */
                className={
                  "-mx-2 flex items-start gap-3 rounded-md border-b border-line px-2 py-3 " +
                  "transition-colors duration-[var(--dur-fast)] ease-out " +
                  "hover:bg-surface focus-within:bg-surface last:border-b-0"
                }
              >
                {/* `self-stretch` rather than a fixed height: the rule is as tall as whatever
                    the row turned out to be, so a card name that wraps to two lines at 360px
                    does not leave a stub floating beside three lines of text.
                    `aria-hidden` because it is pure redundancy — it repeats, in colour, the
                    identity the link states in words immediately to its right. */}
                <span
                  aria-hidden="true"
                  data-attention-marker=""
                  className="w-1.5 shrink-0 self-stretch rounded-full"
                  style={markerStyle(palettes, row.cardId)}
                />

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {/* Name and severity on one line, sentence on the next.
                      ⚠ The sentence used to share this line from `sm` up. It cannot: the
                      sentences run 30–60 characters and the names are unbounded, so on a real
                      dashboard the sentence began in whatever gap the badge left and wrapped —
                      a one-word orphan followed by three full lines, at a different indent on
                      every row. That is the specific thing that made the list unscannable, and
                      a row whose second line always starts at the same x is the fix. */}
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    {/* `min-w-0` + `truncate` + `title`: without `min-w-0` a flex child refuses
                        to shrink past its own content and a long card name pushes the badge off
                        the right edge at 360px instead of ellipsing. `title` is what keeps the
                        full name reachable once it does ellipse.

                        ⚠ The name stays `--ink`, matching the same decision in `reach-bars.tsx`
                        so one card's name is one colour on this screen. It is the row's primary
                        text at **20.03** on `--canvas` and **18.75** on the band; tinting it
                        `--ink-3` on hover would trade that for 4.87 — a hover that makes the
                        thing you are pointing at *harder* to read. The hover response is the
                        band behind it and the underline the link already had. */}
                    <Link
                      href={`/cards/${row.cardId}`}
                      title={row.cardName}
                      className="min-w-0 truncate text-base font-medium text-ink underline-offset-4 hover:underline"
                    >
                      {row.cardName}
                    </Link>
                    {/* ⚠ **The chips keep the primitive's own tones — amber stays amber.**
                        Re-measured against cream rather than assumed to be fine because it was
                        fine before the mint: `--warning-wash` measures **1.00** against
                        `--canvas` and **1.07** against the hover band. The chip's ground is
                        luminance-identical to the page, so it cannot flare — it is not brighter
                        than anything, and the whole chip is a hue event, a small amber patch in
                        a beige field. The loud part is `--warning-ink` at **7.81** on the page
                        and **7.79** on its own wash, and that is the one element on the row that
                        *should* be loud. Deliberate, not alarming, and left exactly as `Badge`
                        draws it.
                        The `neutral` chip is left alone for a second, sharper reason: it is
                        `bg-surface-sunk`, a ground this list also paints with, and keeping the
                        two off each other is what pins the band above at `--surface`. Both tones
                        stay with the primitive so the pair goes on reading as one scale drawn by
                        one component. */}
                    <Badge tone={copy.tone}>{copy.label}</Badge>
                  </div>

                  {/* `--ink-3`, the system's caption ink: see the header. **5.20** on
                      `--canvas` at rest and **4.87** on the hover band, both over 4.5 — and both
                      better than the mint step they replace (4.83 / 4.54). It is
                      chrome-coloured on purpose: the sentence explains the row, it does not rank
                      it, and severity stays with the word in the chip. */}
                  <span className="text-sm text-ink-3">{copy.say(row.count)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hidden > 0 ? (
        /* Not a "show more" toggle: expanding in place would restore exactly the wall of rows
           the cap exists to prevent. This hands the reader the screen that can act on all of
           them, and states the number so the cap is never mistaken for the total. */
        <Link
          href="/cards"
          data-attention-more=""
          className="mt-4 inline-block text-sm text-ink-2 underline-offset-4 hover:underline"
        >
          {hidden} more {hidden === 1 ? "card needs" : "cards need"} attention
        </Link>
      ) : null}
    </section>
  );
}
