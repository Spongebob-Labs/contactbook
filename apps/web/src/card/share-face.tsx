import type { CSSProperties, ReactElement } from "react";

import { FIELD_RENDERERS } from "@/card/field-renderers";
import { QrZone } from "@/card/qr-zone";
import { paletteVars } from "@/card/template-palettes";
import { formatCardLink } from "@/lib/format";
import type { QrRenderMode } from "@/card/qr-geometry";
import type { ResolvedCard, ResolvedField } from "@/types/domain";

/**
 * THE SHARE FACE — the compact artefact you hand someone.
 *
 * ## One format. Colour is the only thing that varies.
 *
 * Every card in the set puts the same thing in the same place:
 *
 *     ┌──────────────────────────────┐
 *     │ [logo]                 ◯     │  brand mark left, portrait right
 *     │                              │
 *     │ ROLE                         │  tag, uppercase, muted
 *     │ Name                         │  large
 *     │                              │
 *     │ LABEL                        │  up to two detail pairs…
 *     │ value                        │
 *     │ LINK                         │  …then the card's own link, always last
 *     │ value                        │
 *     │                              │
 *     │          ▓▓▓▓▓▓              │  QR, centred, on its white plate
 *     │          ▓▓▓▓▓▓              │
 *     └──────────────────────────────┘
 *
 * This module previously offered four compositions and spread the templates across them, so
 * one card had its portrait centred, the next had it in a top band, and a third had none. That
 * is not a set of templates — it is a set of different products wearing the same name. Somebody
 * who has been handed one of these cards should already know where to look on every other one.
 *
 * So the format is a constant here, not a property a template may choose. A template picks a
 * palette and the weight of its name; every position on the card is fixed. There is no
 * `faceLayout`, and `<ShareFace>` takes no layout argument.
 *
 * ## Every slot is always filled
 *
 * A slot that disappears when the data is thin is itself a format variation, so each one has a
 * defined fallback: the logo chip falls back to a monogram, the portrait to a monogram, the
 * role tag to the card's own type. The card looks like the same card whether it carries two
 * fields or twenty.
 *
 * ## What is deliberately NOT here
 *
 * No field list, no action buttons, no scroll container. The face is a pointer to a card, not a
 * summary of one — everything else the owner mapped is one scan away on `<CardPage>`, laid out
 * at full size. An earlier version put four labelled field rows here and clipped an address at
 * both edges; the bounded pair count below is why that cannot recur.
 */

export interface ShareFaceProps {
  resolved: ResolvedCard;
  /**
   * `full` and `export` encode the card's real URL. `thumb` encodes a fixed dummy payload and
   * scales the face down — see `PREVIEW_PAYLOAD` in `qr-zone.tsx` for why a gallery preview
   * must never resolve to a real card.
   */
  mode: QrRenderMode;
  /** `thumb` only — the width to scale the design face into. */
  thumbWidth?: number;
  className?: string;
}

/* ── format constants ───────────────────────────────────────────────────────── */

/**
 * The one face size, and the two constraints that fix it.
 *
 * **Width — 336.** The face is rigid (`flexShrink: 0`), so it is the widest thing on any page
 * that shows it, and it has to fit the narrowest supported viewport. At 360 it did not: the
 * card-detail screen adds 12px of padding each side, so a 360-wide face ran to x=372 on a
 * 360px screen and the whole page scrolled sideways. 336 + 12 + 12 = 360 exactly.
 *
 * **Height — 500.** Not a taste decision; the sum of the format's own parts:
 *
 *     pad                 20
 *     portrait row        56
 *     gap                 16
 *     role tag + name     47
 *     gap                 16
 *     three pairs        115   (label 14 + value 19, three times, plus two 8px gaps)
 *     gap                 16
 *     QR plate           175   (141px symbol + 17px quiet zone on each side)
 *     pad                 20
 *     ─────────────────────
 *     total              481   ≤ 500
 *
 * 1 : 1.49, against the reference card's 1 : 1.39. Nineteen pixels of slack, absorbed by
 * `marginTop: auto` on the QR.
 *
 * ⚠ Change any constant here and re-derive the budget. `tests/e2e/face-format.spec.ts` measures
 * it in a real browser — happy-dom has no layout engine, which is how eight cards once shipped
 * with their QR hanging 15px off the bottom edge past 1,104 passing unit tests.
 *
 * The symbol is 141px, above the 140px scannable floor by one pixel of margin. That is the real
 * constraint on narrowing the card further: below 334 wide, `qrSizePx` clamps to the floor and
 * the ratio stops holding.
 *
 * Not a per-template value. These are wallet passes: they are added to Apple Wallet, they stack
 * in a gallery, and they export to one PNG size, none of which a set that disagrees about its
 * own aspect ratio can do tidily.
 */
export const FACE_WIDTH = 336;
export const FACE_HEIGHT = 500;

/** Retained under the old names for the PNG exporter and the loading skeletons. */
export const CARD_DESIGN_WIDTH = FACE_WIDTH;
export const CARD_DESIGN_HEIGHT = FACE_HEIGHT;

const PAD = 20;
/** Corner radius, portrait diameter and chip height are format, so they are constants. */
const FACE_RADIUS = 20;
const PORTRAIT_PX = 56;

/**
 * How many of the owner's fields reach the face, before the link.
 *
 * Two, matching the reference card's PHONE and EMAIL. The cap is the load-bearing part: it is
 * what keeps this a pass rather than a contact sheet, and it is what stops the vertical budget
 * below from ever being exceeded by a card with twenty fields mapped to it.
 */
export const MAX_DETAIL_PAIRS = 2;

/* ── slot selection — every slot has a fallback so none can vanish ──────────── */

/** Initials from the display name; a card may carry a business name rather than a person's. */
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

const CARD_TYPE_TAG: Record<ResolvedCard["cardType"], string> = {
  BUSINESS: "Business",
  PERSONAL: "Personal",
  PAYMENT: "Payment",
  CUSTOM: "Card",
};

/**
 * The brand mark. The company if the card carries one, else the owner's initials.
 *
 * Never empty: an absent chip would leave the top-left corner blank on some cards and filled on
 * others, which is the format varying with the data.
 */
function markLabel(resolved: ResolvedCard): string {
  const company = resolved.fields.find((f) => f.type === "COMPANY")?.value;
  return company ?? initialsFor(resolved.fullName);
}

/** The tag above the name: the job title, else the card's own type. Never empty. */
function roleTag(resolved: ResolvedCard): string {
  const title = resolved.fields.find((f) => f.type === "JOB_TITLE")?.value;
  return title ?? CARD_TYPE_TAG[resolved.cardType];
}

/**
 * Field types the face will show, in preference order: a number, then an email, then a website.
 *
 * A closed list, and short on purpose. The card carries **a name, a number, an email and the
 * link** — that is the whole content model, and anything outside this list is not eligible for
 * the face however the owner has ordered their profile.
 *
 * This is narrower than it was, and the reason is a real defect rather than taste. The previous
 * version fell back to "whatever the owner's ordering offers next", so a business card with no
 * phone number put its office ADDRESS on the face — a 70-character string in a 300px column,
 * ellipsised mid-word. An address is not a contact handle you read off a card at arm's length;
 * it belongs on the scan page, at full width, where it already is.
 *
 * ⚠ **Exported.** The builder's "Add a field" modal ranks its *Suggested* list by this same
 * order, so the six fields it offers first are the ones that can actually reach the face. It
 * reads this array rather than repeating three strings, because a copy would keep suggesting
 * `URL` on the day the face stopped showing one.
 */
export const FACE_FIELD_PREFERENCE: readonly ResolvedField["type"][] = ["PHONE", "EMAIL", "URL"];

/**
 * The two detail pairs, matching the reference card: a number, then an email.
 *
 * Sensitive fields are never eligible. A share face is the most public surface in the product —
 * it is photographed, printed and left on desks — and a masked account number on it says
 * nothing useful while still announcing that an account number exists. `COMPANY` and
 * `JOB_TITLE` are absent from the preference list because they already appear, as the chip and
 * the role tag.
 */
export function selectDetailPairs(resolved: ResolvedCard): ResolvedField[] {
  const eligible = resolved.fields.filter(
    (f) => !f.isSensitive && FACE_FIELD_PREFERENCE.includes(f.type),
  );
  const rank = (f: ResolvedField) => FACE_FIELD_PREFERENCE.indexOf(f.type);
  return [...eligible]
    .map((f, i) => ({ f, i }))
    /* Preference first, then the owner's own ordering as the tie-break — so two phone numbers
       resolve to the one they put first, not to whichever the sort happened to see first. */
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .map(({ f }) => f)
    .slice(0, MAX_DETAIL_PAIRS);
}

/* ── the labelled pair ──────────────────────────────────────────────────────── */

/**
 * A small uppercase label over a value — the device the reference card uses for every piece of
 * information on it.
 *
 * The value is always one line and always ellipsises, and the pair is always left-aligned.
 * Left-aligned matters: centred text has no single edge to trim into, which is precisely how an
 * earlier version clipped an address at both ends instead of ellipsising it at one.
 */
function Pair({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): ReactElement {
  return (
    <div
      data-card-pair=""
      style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}
    >
      <span
        data-card-pair-label=""
        style={{
          fontSize: "var(--text-overline)",
          letterSpacing: "var(--text-overline-tracking)",
          textTransform: "uppercase",
          color: "var(--c-ink-soft)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
      <span
        data-field-value=""
        title={value}
        style={{
          fontSize: "var(--text-base)",
          fontWeight: "var(--weight-medium)",
          fontFamily: mono ? "var(--font-mono)" : undefined,
          color: "var(--c-ink)",
          lineHeight: 1.25,
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ── the face ───────────────────────────────────────────────────────────────── */

export function ShareFace({
  resolved,
  mode,
  thumbWidth = 200,
  className,
}: ShareFaceProps): ReactElement {
  const { template } = resolved;
  /* The resolved palette — the card's own choice if it made one. Never looked up from the
     template here: that would ignore the owner's colour. */
  const palette = resolved.palette;
  const link = formatCardLink(resolved.qrPayload, 34);
  const pairs = selectDetailPairs(resolved);

  const root: CSSProperties = {
    ...(paletteVars(palette) as CSSProperties),
    width: `${FACE_WIDTH}px`,
    height: `${FACE_HEIGHT}px`,
    borderRadius: `${FACE_RADIUS}px`,
    /* Colour first, then the gradient over it. If the gradient ever failed to parse the card
       would still be its own solid ground rather than transparent — and `background-color` is
       also what the flat contexts (exporter fallbacks, OpenGraph) read. */
    backgroundColor: "var(--c-ground)",
    backgroundImage: "var(--c-ground-gradient)",
    color: "var(--c-ink)",
    fontFamily: "var(--font-sans)",
    /* `--c-face-border` is `transparent` on every palette but Paper, whose ground is the same
       white as the page and would otherwise have no edge at all. */
    border: "1px solid var(--c-face-border, transparent)",
    /* Clipped, never scrollable. If the content overflows this box that is a layout bug to fix
       at the source; hiding it behind a scrollbar is what produced the previous build's clipped
       rows. The bounded pair count above is what keeps the budget solvable. */
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexShrink: 0,
    boxShadow: "var(--elevation-card)",
  };

  const face = (
    <div
      data-card-root=""
      data-card-variant="face"
      data-template-id={template.id}
      data-palette-id={palette.id}
      data-render-mode={mode}
      className={mode === "thumb" ? undefined : className}
      style={root}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: `${PAD}px`,
          gap: "16px",
          minWidth: 0,
        }}
      >
        {/* ── brand mark left, portrait right ─────────────────────────────── */}
        <div
          data-card-header=""
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "var(--space-3)",
            minWidth: 0,
          }}
        >
          <MarkChip label={markLabel(resolved)} />
          <Portrait resolved={resolved} />
        </div>

        {/* ── role tag over name ──────────────────────────────────────────── */}
        <div
          data-card-identity=""
          style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}
        >
          <span
            data-card-role=""
            style={{
              fontSize: "var(--text-overline)",
              letterSpacing: "var(--text-overline-tracking)",
              textTransform: "uppercase",
              color: "var(--c-ink-soft)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {roleTag(resolved)}
          </span>
          <span
            data-card-name=""
            title={resolved.fullName}
            style={{
              fontSize: "var(--text-h2)",
              fontWeight: template.type.nameWeight,
              letterSpacing: `${template.type.nameTracking}em`,
              color: "var(--c-ink)",
              lineHeight: 1.15,
              /* ONE line, ellipsised. Two lines on one card and one on the next is the format
                 varying with the data — and it also overflows: a second line pushes the QR's
                 reserved box off a fixed-height canvas. The full name is on the `title` and on
                 the scan page; the face is a pointer, not the record. */
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {resolved.fullName}
          </span>
        </div>

        {/* ── detail pairs, then the link, always last ─────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
          {pairs.map((field) => {
            const row = FIELD_RENDERERS[field.type](field, { iconSize: 16 });
            if (row === null) return null;
            return <Pair key={field.id} label={row.label} value={row.display} />;
          })}
          <Pair label="Link" value={link} mono />
        </div>

        {/* ── QR, centred, pinned to the foot ─────────────────────────────── */}
        <div style={{ marginTop: "auto", display: "flex", justifyContent: "center" }}>
          {/* No caption and no decoration, on any template: the reference card frames its
              symbol with nothing but the plate, and a symbol decorated differently per card is
              the format varying again. */}
          <QrZone payload={resolved.qrPayload} cardWidth={FACE_WIDTH} mode={mode} />
        </div>
      </div>
    </div>
  );

  if (mode !== "thumb") return face;

  /* `thumb` is the one mode that scales. The design face is rendered at full size and
     transformed, so a thumbnail is pixel-identical to the card it stands for rather than a
     second layout that has to be kept in sync with the first. */
  const scale = thumbWidth / FACE_WIDTH;
  return (
    <div
      /* The scaled wrapper is the thumbnail's outer box, and the stable hook for anything that
         needs to find or size a thumbnail from outside — the auth showcase and the card tiles
         both locate it this way. My rewrite dropped this attribute and took those with it. */
      data-card-thumb=""
      className={className}
      style={{
        width: `${thumbWidth}px`,
        height: `${Math.round(FACE_HEIGHT * scale)}px`,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>{face}</div>
    </div>
  );
}

/* ── the two header slots ───────────────────────────────────────────────────── */

/**
 * The brand chip, top-left. Painted in the palette's action colours, which the palette contract
 * already proves legible — a logo that fails contrast is still a failed logo.
 */
function MarkChip({ label }: { label: string }): ReactElement {
  return (
    <span
      data-card-mark=""
      style={{
        display: "inline-flex",
        alignItems: "center",
        maxWidth: `${FACE_WIDTH - PORTRAIT_PX - PAD * 2 - 16}px`,
        paddingInline: "10px",
        height: "26px",
        borderRadius: "var(--radius-sm)",
        background: "var(--c-button-bg)",
        color: "var(--c-button-ink)",
        fontSize: "var(--text-overline)",
        fontWeight: "var(--weight-semibold)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        flexShrink: 1,
      }}
    >
      {label}
    </span>
  );
}

/** The portrait, top-right. A photograph when there is one, the owner's initials when not. */
function Portrait({ resolved }: { resolved: ResolvedCard }): ReactElement {
  const base: CSSProperties = {
    width: `${PORTRAIT_PX}px`,
    height: `${PORTRAIT_PX}px`,
    borderRadius: "var(--radius-full)",
    overflow: "hidden",
    flexShrink: 0,
  };

  if (resolved.avatar.kind === "photo") {
    return (
      <span data-card-portrait="photo" style={base}>
        {/* A plain <img>, deliberately: this subtree is serialised by html-to-image for the PNG
            export, and next/image's wrapper markup, srcset and lazy loading do not survive that
            serialisation — the portrait comes out blank in the exported file. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolved.avatar.url}
          alt={resolved.avatar.alt}
          width={PORTRAIT_PX}
          height={PORTRAIT_PX}
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
        fontSize: `${Math.round(PORTRAIT_PX * 0.34)}px`,
        fontWeight: "var(--weight-semibold)",
        lineHeight: 1,
      }}
    >
      {resolved.avatar.initials}
    </span>
  );
}
