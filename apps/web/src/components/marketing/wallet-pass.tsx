import type { ReactElement } from "react";

import QRCode from "qrcode";

import { exampleCardSpecs, heroPhone, mayaProfile } from "@/fixtures/marketing";

import { BRAND_CARD_FONT_VARIABLES } from "./hero-fonts";

/**
 * THE APPLE WALLET PASS, AS THE PRODUCT SIGNS IT — How-it-works frame 03. 2026-10-06.
 *
 * The client, on the frame that showed the in-app card here: *"this is not the actual card that we
 * are making for the Apple Wallet … what we are offering the user should be the actual thing, no
 * disparity."* So this is a drawing of the pass `apps/api/src/wallet/pass-builder.ts` builds for a
 * card, at the same layout Wallet gives it, and every choice below is copied from that code rather
 * than designed here:
 *
 *   · **Style `eventTicket`** (`buildPassJson`) — the style that takes a full-bleed background
 *     image, and the one Wallet draws with a semicircular notch in its top edge.
 *   · **The ground** is `background.png` from `renderBackgrounds`: the card palette's two stops at
 *     155° (`pass-colors.util.ts`; the Work card is sapphire). Text is the palette's ink, labels
 *     its muted ink — `foregroundColor` / `labelColor`.
 *   · **The header** is `logo.png` from `renderLogos` — the CB mark only, in `BRAND_GOLD`, fitted
 *     to the logo's 50pt height and padded with transparency to the full 160×50pt box — and then
 *     `logoText`, the card's COMPANY value in capitals.
 *   · **Primary field**: label = the role (JOB_TITLE, else headline, else the card type), value =
 *     the owner's name. **Thumbnail**: the owner's photo cut to a circle with a 35% ink ring
 *     (`renderThumbnails`), right of the name.
 *   · **Secondary and auxiliary fields**: at most two details, a PHONE before an EMAIL before a
 *     URL, owner's order breaking ties (`selectPassContent`), each printed as the field's label and
 *     its value AS STORED — the pass does not reformat a number.
 *   · **Barcode**: a QR of the card's public link on Wallet's white plate, with `altText` "Scan to
 *     open card" under it. The link itself is on the back of the pass, so the front carries no URL.
 *
 * Wallet, not the pass, draws the outer rounded corners, the notch and the QR plate; those are
 * drawn here from Wallet's own appearance. Decorative: the frame it sits in is `aria-hidden`.
 */

/** `KIND_TAG` in `pass-builder.ts` — the role when a card has no job title or headline. */
const KIND_TAG: Readonly<Record<string, string>> = {
  BUSINESS: "Business",
  WORK: "Business",
  PERSONAL: "Personal",
  PAYMENT: "Payment",
  CUSTOM: "Card",
};

/** `DETAIL_PREFERENCE` / `MAX_DETAIL_PAIRS` in `pass-builder.ts`. */
const DETAIL_PREFERENCE = ["PHONE", "EMAIL", "URL"] as const;
const MAX_DETAIL_PAIRS = 2;

/** `altText` on the pass's one barcode. */
export const PASS_ALT_TEXT = "Scan to open card";

export interface WalletPassContent {
  readonly cardId: string;
  readonly paletteId: string;
  /** `logoText` — the COMPANY value, upper-cased by the builder. */
  readonly logoText: string;
  /** The primary field's label. */
  readonly role: string;
  /** The primary field's value. */
  readonly name: string;
  /** Secondary then auxiliary field, in that order; zero to two. */
  readonly details: readonly { readonly label: string; readonly value: string }[];
  /** The barcode message — the card's public link. */
  readonly qrPayload: string;
}

/**
 * What the pass for one of Maya's example cards says — `selectPassContent` and `buildPassJson`'s
 * rules, applied to the same fixture records every other frame resolves through.
 */
export function walletPassContent(cardId: string): WalletPassContent {
  const spec = exampleCardSpecs.find((candidate) => candidate.id === cardId);
  if (!spec) throw new Error(`wallet-pass: no example card "${cardId}"`);
  const card = spec.card;
  if (!card.publicUrl) throw new Error(`wallet-pass: card "${cardId}" has no public link`);

  const fields = card.fieldIds
    .map((id) => mayaProfile.fields.find((field) => field.id === id))
    .filter((field): field is NonNullable<typeof field> => field !== undefined)
    .filter((field) => field.value.trim() !== "");

  const firstOf = (type: string) => fields.find((field) => field.type === type)?.value.trim();

  const details = fields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => (DETAIL_PREFERENCE as readonly string[]).includes(field.type))
    .sort(
      (a, b) =>
        (DETAIL_PREFERENCE as readonly string[]).indexOf(a.field.type) -
          (DETAIL_PREFERENCE as readonly string[]).indexOf(b.field.type) || a.index - b.index,
    )
    .slice(0, MAX_DETAIL_PAIRS)
    .map(({ field }) => ({ label: field.label, value: field.value.trim() }));

  const company = firstOf("COMPANY");
  return {
    cardId,
    paletteId: card.paletteId ?? "sapphire",
    logoText: (company ?? "ContactBook").toUpperCase(),
    role: firstOf("JOB_TITLE") ?? KIND_TAG[card.type] ?? "Card",
    name: heroPhone.name,
    details,
    qrPayload: card.publicUrl,
  };
}

/** The QR as one path of unit squares, quiet zone excluded (the plate's padding is the zone). */
function qrPath(payload: string): { size: number; d: string } {
  const symbol = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const size = symbol.modules.size;
  let d = "";
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (symbol.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size, d };
}

export function WalletPass({ content }: { content: WalletPassContent }): ReactElement {
  const qr = qrPath(content.qrPayload);
  const [secondary, auxiliary] = content.details;

  return (
    <div
      className={`mk-pass ${BRAND_CARD_FONT_VARIABLES}`}
      data-wallet-pass=""
      data-pass-style="eventTicket"
      data-card-id={content.cardId}
      data-palette-id={content.paletteId}
      inert
    >
      <div className="mk-pass__header">
        <span className="mk-pass__logo" aria-hidden="true">
          <span className="mk-pass__mark" />
        </span>
        <span className="mk-pass__logo-text">{content.logoText}</span>
      </div>

      <div className="mk-pass__fields">
        <div className="mk-pass__field mk-pass__field--primary" data-pass-field="primary">
          <span className="mk-pass__label">{content.role}</span>
          <span className="mk-pass__value">{content.name}</span>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="mk-pass__thumb"
          src={heroPhone.portrait.x2}
          srcSet={`${heroPhone.portrait.x2} 2x, ${heroPhone.portrait.x3} 3x`}
          alt=""
          width={90}
          height={90}
          loading="lazy"
          decoding="async"
        />

        {secondary ? (
          <div className="mk-pass__field mk-pass__field--secondary" data-pass-field="secondary">
            <span className="mk-pass__label">{secondary.label}</span>
            <span className="mk-pass__value">{secondary.value}</span>
          </div>
        ) : null}

        {auxiliary ? (
          <div className="mk-pass__field mk-pass__field--auxiliary" data-pass-field="auxiliary">
            <span className="mk-pass__label">{auxiliary.label}</span>
            <span className="mk-pass__value">{auxiliary.value}</span>
          </div>
        ) : null}
      </div>

      <div className="mk-pass__plate" data-pass-barcode="" data-qr-payload={content.qrPayload}>
        <svg
          className="mk-pass__qr"
          viewBox={`0 0 ${qr.size} ${qr.size}`}
          shapeRendering="crispEdges"
          aria-hidden="true"
          focusable="false"
        >
          <path d={qr.d} />
        </svg>
        <span className="mk-pass__alt">{PASS_ALT_TEXT}</span>
      </div>
    </div>
  );
}
