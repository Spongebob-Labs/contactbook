import { renderFieldRow } from "@/card/field-renderers";
import { QrZone } from "@/card/qr-zone";
import { FACE_WIDTH } from "@/card/share-face";
import { FIXTURE_DB } from "@/fixtures";
import { demo } from "@/fixtures/marketing";
import { formatCardLink } from "@/lib/format";
import type { ResolvedCard, ResolvedField } from "@/types/domain";

import { ObjectLabel } from "./bento";
import { mkcn } from "./mk-cn";
import { Prose } from "./type";

/**
 * The three server-rendered exhibits in the bento — the QR, the profile stack and the fan.
 *
 * They live together because they share one property that is easy to lose one file at a time:
 * **none of them is a picture of the product.** The symbol is encoded by the product's own
 * `<QrZone>` from the product's own payload, the rows are rendered by the product's own field
 * registry from the fixture profile, and the fan is drawn here because the thing it depicts —
 * a message arriving on somebody else's phone — is the one step in the sequence that has no
 * artefact inside this repository to mount.
 *
 * They are also all server components, deliberately. The studio beside them has to be a client
 * island because pressing a swatch re-renders a card; nothing here reacts to anything, so
 * nothing here costs the page a byte of JavaScript.
 */

/* ── 03 · the QR ────────────────────────────────────────────────────────────── */

/**
 * The real one.
 *
 * ## ⚠ `mode="full"`, and this is the deliberate half of the pair
 * The studio's wallet pass is `mode="thumb"`: scaled, therefore under the 140px decode floor,
 * therefore carrying a dummy payload so a symbol that cannot be scanned is never claiming to
 * point at a real card. This symbol is the opposite in every respect. `cardWidth={FACE_WIDTH}`
 * is the card's own 336px, so `qrSizePx` resolves to **141px** — one pixel above
 * `MIN_QR_SIZE_PX` — and the payload is `resolved.qrPayload`, the same string the card's own
 * face encodes. Point a phone at the page and `/c/{slug}` opens.
 *
 * That is worth the cell it takes. The page's argument is that this product tells the truth
 * about what software can do; a QR on it that turns out to be a drawing of a QR would be the
 * cheapest possible way to lose that argument, and a reader with a phone can check in two
 * seconds.
 *
 * ## Why the cell is Onyx
 * `<QrZone>`'s plate is an opaque white rectangle and always will be — many decoders reject an
 * inverted symbol, so the plate is never tinted whatever the card is doing around it, and
 * `--c-plate-border` (the one per-palette escape) resolves to nothing outside a card root. A
 * white plate on a white cell therefore has no edge at all: the most important object on the
 * page would render as a hole in it. On Onyx it reads as a plate lying on a dark card, which is
 * what every deep palette in the product already does with it.
 *
 * ## The link line is `formatCardLink`, not the payload
 * The symbol encodes `qrPayload` verbatim, so a card scanned against a dev server opens on the
 * dev server. The caption swaps a dev host for the product domain, because a homepage printing
 * `localhost:3000` reads as a broken build rather than as a working demonstration. The two are
 * allowed to disagree in exactly that one respect and `format.ts` is where the decision is
 * recorded — this component only calls it.
 */
export function ScanExhibit({ resolved }: { resolved: ResolvedCard }) {
  return (
    <div className="mt-7 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8 md:mt-8">
      {/*
        The plate first in the DOM and first on the line, because it is the subject: this is the
        one thing in the grid a reader points a camera at, and the sentence beside it is a
        caption for it rather than the other way round.

        `shrink-0` is not optional — the plate's side is computed from the card's own geometry
        (141px symbol plus a quiet zone that the encoder's module count decides), and a flex
        parent squeezing it by even a few pixels resamples every module edge, which is the
        documented way to make a symbol stop decoding.
      */}
      <div data-scan-exhibit="" className="flex shrink-0 justify-center sm:justify-start">
        <QrZone payload={resolved.qrPayload} cardWidth={FACE_WIDTH} mode="full" />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Prose size="small" className="max-w-mk-measure-tight text-mk-white/75">
          {demo.scanHint}
        </Prose>

        {/*
          The destination, in the mono face, in the same shape the wallet pass prints it. It is
          not a link: this cell is showing what the symbol contains, and a reader who wants to
          go there has a button in the hero and one at the foot of the page.
        */}
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <ObjectLabel onInk as="span">
            {demo.linkLabel}
          </ObjectLabel>
          <span className="font-mk-mono text-mk-body-sm text-mk-white">
            {formatCardLink(resolved.qrPayload)}
          </span>
        </p>
      </div>
    </div>
  );
}

/* ── 01 · the profile stack ─────────────────────────────────────────────────── */

/**
 * Five real rows out of the fixture profile, rendered by the product's own field registry.
 *
 * ## Why these seven, and why two of them are private
 * The step this cell heads says *"mark anything private and it stays masked in the product and
 * off every card you share"*, and three other passes make the same promise in prose —
 * `fieldCatalogue.note`, `trust.panels.private`, and the FAQ's `sensitive` answer. Four
 * statements of a rule and no demonstration of it is the shape of a claim nobody checks.
 *
 * So the set is chosen to show the rule operating rather than to look tidy: five kinds of field
 * any card can carry — a number, an email, a company, a website, a social handle — and then a
 * home landline and a business bank account that no card can. `renderFieldRow` decides which is
 * which; the two private rows come back with `masked: true`, their `display` already scrubbed
 * by `maskTail`, their `href` already `null` and their `title` already equal to the masked
 * string.
 *
 * ⚠ **Every masked row in this set is masked because its owner marked it**, and that is why
 * `field_upi`, `field_paypal` and `field_crypto` are absent even though they would add variety.
 * Those three are in `ALWAYS_MASKED_TYPES` — masked by their type whatever the owner chose — so
 * a "Private" marker beside one would be telling the reader something that is not true of it.
 * The marker and the mask have to mean the same thing on this page or the demonstration is
 * teaching the wrong rule.
 *
 * Seven rows rather than five is also a layout decision, and an honest one: this is the shorter
 * cell in a row whose height is set by the studio beside it, and a cell filled with two more
 * real fields is better than the same cell filled with air.
 *
 * ## ⚠ THE MASKED VALUE NEVER REACHES THE DOM, AND THAT IS NOT THIS FILE'S DOING
 * `PRODUCT.md` is absolute about it: *"a masked value must not reach the DOM — not as text, not
 * in an attribute."* This component renders `row.display` and `row.title`, both of which the
 * registry has already replaced. It never touches `field.value`. Writing the mask here instead
 * — even correctly — would be a second implementation of the product's single most important
 * security rule, sitting on the one page that is served to everybody.
 *
 * ## Why the rows are built here rather than resolved through a card
 * `resolveCard` needs a `ContactCard`, and a card that mapped a private field would be a
 * fabricated fixture contradicting the rule this cell exists to show. The five ids below are
 * real `ProfileField`s and the category comes from their real group, so the only thing this
 * function invents is the selection.
 */
const PROFILE_ROW_IDS = [
  "field_mobile",
  "field_work_email",
  "field_company",
  "field_site_url",
  "field_linkedin",
  "field_home_landline",
  "field_bank",
] as const;

interface ProfileRow {
  id: string;
  label: string;
  display: string;
  title: string;
  icon: React.ReactNode;
  masked: boolean;
}

function profileRows(): ProfileRow[] {
  const categoryOf = new Map(FIXTURE_DB.groups.map((group) => [group.id, group.category]));
  const rows: ProfileRow[] = [];

  for (const id of PROFILE_ROW_IDS) {
    const field = FIXTURE_DB.fields.find((candidate) => candidate.id === id);
    if (field === undefined) continue;
    const category = categoryOf.get(field.groupId);
    if (category === undefined) continue;

    const resolved: ResolvedField = {
      id: field.id,
      type: field.type,
      category,
      label: field.label,
      value: field.value,
      isSensitive: field.isSensitive,
      ...(field.detail === undefined ? {} : { detail: field.detail }),
    };

    const row = renderFieldRow(resolved, { iconSize: 16 });
    if (row === null) continue;

    rows.push({
      id: field.id,
      label: row.label,
      display: row.display,
      title: row.title,
      icon: row.icon,
      masked: row.masked,
    });
  }

  return rows;
}

/** The padlock. Drawn, 2px, `currentColor` — the same shackle `trust.tsx` draws, at 14px. */
function PrivateMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-private-mark=""
      className="size-3.5 shrink-0"
    >
      <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
      <path d="M8.25 10V7a3.75 3.75 0 0 1 7.5 0v3" />
    </svg>
  );
}

export function ProfileExhibit() {
  const rows = profileRows();

  return (
    <div className="mt-7 flex flex-col gap-3 md:mt-8">
      <ObjectLabel>{demo.profileLabel}</ObjectLabel>

      {/*
        A `<dl>`, because every row is a label and its value. The interior separation is one
        hairline per shared edge drawn by the row that follows it — the same construction every
        ruled set on this page uses, so the outer edges stay clean with no `first:` negation.
      */}
      <dl className="flex flex-col [&>*+*]:mt-3 [&>*+*]:border-t [&>*+*]:border-mk-hairline [&>*+*]:pt-3">
        {rows.map((row) => (
          /*
            ⚠ THE GROUP `<div>` MAY CONTAIN NOTHING BUT `<dt>` AND `<dd>`, AND THAT IS WHY THE
            ICON AND THE MARKER LIVE INSIDE THE `<dd>` RATHER THAN BESIDE IT.

            HTML5 allows `dl > div > (dt, dd)` as a grouping, and only that: any other direct
            child of the group is invalid, and an `<dt>`/`<dd>` nested one level deeper is no
            longer inside a definition list at all. The first version of this row put the icon
            and the marker in the group and wrapped the pair in a flex column, which produced
            two serious axe violations — `definition-list` on the `<dl>` and `dlitem` on all
            fourteen terms — while looking completely correct on screen. Layout inside a `<dd>`
            is free; layout between `<dt>` and `<dd>` is not.
          */
          <div
            key={row.id}
            data-profile-row={row.id}
            data-masked={row.masked ? "" : undefined}
            className="flex flex-col gap-0.5"
          >
            {/*
              The owner's own label over the value, which is how the product's own profile
              screen sets a field and the reason this reads as a profile rather than as a list
              of strings. It also carries the one thing the value cannot: two rows here are
              phone numbers, and only "Mobile" and "Home landline" say which is which.

              `pl-7` is the icon's 16px plus the row's 12px gap, so the label sits over the
              value's first character rather than over the icon.
            */}
            <dt className="pl-7 font-mk-sans text-mk-caption text-mk-pebble">{row.label}</dt>

            <dd title={row.title} className="m-0 flex items-center gap-3">
              {/*
                The registry's own icon, at 16px, in `--mk-pebble` (4.52:1 on white). It
                restates nothing — a handset beside a row labelled "Mobile" is redundant to a
                screen reader, which is why the registry marks every one of them `aria-hidden`.
              */}
              <span className="shrink-0 text-mk-pebble" aria-hidden="true">
                {row.icon}
              </span>

              <span
                className={mkcn(
                  "min-w-0 flex-1 truncate font-mk-sans text-mk-body-sm",
                  row.masked ? "text-mk-pebble" : "text-mk-ink",
                )}
              >
                {row.display}
              </span>

              {/*
                The private marker. A drawn padlock AND the word, never the padlock alone:
                status is never carried by an icon or a colour by itself, and this is the one
                status on the page a reader has to be able to trust at a glance.
              */}
              {row.masked ? (
                <span className="flex shrink-0 items-center gap-1.5 text-mk-oxblood">
                  <PrivateMark />
                  <span className="font-mk-sans text-mk-caption font-mk-medium">
                    {demo.privateLabel}
                  </span>
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ── 04 · the fan ───────────────────────────────────────────────────────────── */

/**
 * The broadcast, drawn.
 *
 * ## ⚠ Why this one cell is an illustration when every other is a mounted component
 * The other three exhibits mount something the repository contains. This step does not have
 * one: what it depicts is a message arriving on **somebody else's** phone, over a transport
 * this build does not connect (`PRODUCT.md`: *"this build has no persistence and makes zero
 * outbound requests"*). The two dishonest ways to fill the cell are a mocked-up WhatsApp
 * thread, which would be a picture of software that does not exist, and a stock photograph of
 * a person holding a phone, which is the tell this whole redesign exists to remove.
 *
 * A drawing is the honest third option: it is obviously a diagram, it claims nothing about a
 * running system, and it is drawn in the page's own vocabulary — inline SVG, 2px stroke,
 * `currentColor`, `aria-hidden`, the same rule `trust.tsx` follows.
 *
 * ## The three marks are generic on purpose
 * A speech bubble, a handset and an envelope, for WhatsApp, SMS and email in that order. None
 * of them is a brand mark and none may become one: reproducing a third party's logo on a
 * marketing page is a legal question rather than a design one, and the copy already names the
 * three transports in words two passes below.
 *
 * `aria-hidden` on the whole figure — the step's own body says "send it to the people who
 * opted in to hear from you", so the diagram restates copy that is already in the DOM directly
 * above it, and a screen reader announcing an unlabelled graphic adds nothing.
 */
export function ReachExhibit() {
  return (
    <div className="mt-7 flex flex-col gap-3 md:mt-8">
      <ObjectLabel>{demo.reachLabel}</ObjectLabel>

      <svg
        viewBox="0 0 292 116"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-reach-fan=""
        className="h-auto w-full max-w-[292px] text-mk-ink"
      >
        {/*
          The card, left. 40 x 60 at the product's own 336:500 ratio (40 x 59.5, rounded), with
          the three marks its own face carries reduced to three strokes — a chip, a name and a
          symbol — so the object at the origin of the fan is recognisably the same object the
          two cells above it render at full size.
        */}
        <rect x="3" y="28" width="40" height="60" rx="6" />
        <path d="M10 40h12" />
        <path d="M10 48h20" />
        <rect x="14" y="60" width="18" height="18" rx="2" />

        {/*
          Three connectors, drawn as one curve each from the card's right edge. They are the
          only dashed strokes in the drawing and that is the whole semantic: a solid stroke is
          an object, a dashed one is a message in flight. `pathLength` is not used and must not
          be — the dashes are geometry, not an animation waiting to be added.
        */}
        <g strokeDasharray="4 5" className="text-mk-pebble" stroke="currentColor">
          <path d="M43 58C 90 58, 100 22, 148 22" />
          <path d="M43 58H148" />
          <path d="M43 58C 90 58, 100 94, 148 94" />
        </g>

        {/* The speech bubble, with its tail on the leading edge — chat. */}
        <g transform="translate(156 8)">
          <path d="M4 1h20a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H12l-6 5v-5H4a3 3 0 0 1-3-3V4a3 3 0 0 1 3-3z" />
        </g>

        {/* The handset — a message to a number rather than to an account. */}
        <g transform="translate(160 80)">
          <rect x="1" y="1" width="20" height="32" rx="4" />
          <path d="M8 27h6" />
        </g>

        {/* The envelope. Two strokes, no fold lines: at this size a third stroke fills in. */}
        <g transform="translate(156 44)">
          <rect x="1" y="4" width="28" height="20" rx="3" />
          <path d="M2 7l13 9 13-9" />
        </g>

        {/*
          Three recipients, right. A dot rather than a person glyph: a drawn figure at 10px is a
          blob, and the copy is about people who opted in, not about how many of them there are.
        */}
        <g className="text-mk-pebble" stroke="currentColor">
          <circle cx="252" cy="21" r="5" />
          <circle cx="252" cy="58" r="5" />
          <circle cx="252" cy="95" r="5" />
          <path d="M196 21h48" strokeDasharray="4 5" />
          <path d="M186 58h58" strokeDasharray="4 5" />
          <path d="M186 95h58" strokeDasharray="4 5" />
        </g>
      </svg>
    </div>
  );
}
