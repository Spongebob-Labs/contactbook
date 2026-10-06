import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PKPass } from 'passkit-generator';
import { resolvePassTheme } from './pass-colors.util';
import { deriveAuthToken } from './pass-auth.util';
import {
  fetchPhoto,
  renderBackgrounds,
  renderLogos,
  renderThumbnails,
} from './pass-images';

const ASSETS_DIR = join(__dirname, 'assets');

function loadAsset(name: string): Buffer {
  try {
    return readFileSync(join(ASSETS_DIR, name));
  } catch {
    throw new Error(
      `WALLET_ASSETS_MISSING: required pass asset '${name}' not found in ${ASSETS_DIR}`,
    );
  }
}

// Loaded lazily on first pass generation so a missing PNG does not crash
// startup when WALLET_* vars are absent and the feature is off.
let ICON: Buffer | undefined;
let ICON_2X: Buffer | undefined;
let ICON_3X: Buffer | undefined;

function getAssets() {
  ICON ??= loadAsset('icon.png');
  ICON_2X ??= loadAsset('icon@2x.png');
  ICON_3X ??= loadAsset('icon@3x.png');
  return { ICON, ICON_2X, ICON_3X };
}

export interface PassCard {
  id: string;
  name: string;
  /** `WORK | PERSONAL | PAYMENT | CUSTOM` — the fallback for the small tag above the name. */
  kind?: string;
  headline: string | null;
  publicToken: string;
  archivedAt: Date | null;
  templateId: string;
  paletteId: string | null;
  groundHex: string | null;
}

/**
 * A field the card shares, as the pass needs it: only what a detail row prints. The caller must
 * pass **visible, non-archived, non-encrypted** fields in the card's own order — ciphertext (the
 * financial types) must never reach here.
 */
export interface PassCardField {
  type: string;
  label: string;
  value: string;
}

export interface PassOwner {
  firstName: string | null;
  lastName: string | null;
  /** The owner's profile photo (a public GCS URL), or null for the silhouette. */
  photoUrl?: string | null;
}

export interface PassConfig {
  passTypeId: string;
  teamId: string;
  orgName: string;
  webServiceUrl: string;
  signerCertPem: string;
  signerKeyPem: string;
  signerKeyPassphrase: string | undefined;
  wwdrCertPem: string;
  authSecret: string;
  shareBaseUrl: string;
}

/** What the web's share face shows for each kind when the card has no job title. */
const KIND_TAG: Record<string, string> = {
  WORK: 'Business',
  PERSONAL: 'Personal',
  PAYMENT: 'Payment',
  CUSTOM: 'Card',
};

/** Field types a detail row may show, in preference order — `FACE_FIELD_PREFERENCE` on the web. */
const DETAIL_PREFERENCE = ['PHONE', 'EMAIL', 'URL'];
const MAX_DETAIL_PAIRS = 2;

/**
 * The same selection rules as the web's share face (`share-face.tsx`), so the pass says what the
 * card says:
 *
 * · **company** — the card's `COMPANY` value (the face's brand mark);
 * · **role** — the `JOB_TITLE` value, else the card's headline, else the card's type;
 * · **details** — up to two pairs, a number then an email then a website, owner's order breaking
 *   ties. Nothing else is eligible: not an address (too long to read off a card), not a financial
 *   field.
 */
export function selectPassContent(
  card: Pick<PassCard, 'headline' | 'kind'>,
  fields: readonly PassCardField[],
): { company: string | null; role: string; details: PassCardField[] } {
  const firstOf = (type: string) =>
    fields.find((f) => f.type === type && f.value.trim() !== '')?.value.trim();

  const details = fields
    .map((f, i) => ({ f, i }))
    .filter(
      ({ f }) => DETAIL_PREFERENCE.includes(f.type) && f.value.trim() !== '',
    )
    .sort(
      (a, b) =>
        DETAIL_PREFERENCE.indexOf(a.f.type) -
          DETAIL_PREFERENCE.indexOf(b.f.type) || a.i - b.i,
    )
    .map(({ f }) => ({ ...f, value: f.value.trim() }))
    .slice(0, MAX_DETAIL_PAIRS);

  return {
    company: firstOf('COMPANY') ?? null,
    role:
      firstOf('JOB_TITLE') ??
      (card.headline?.trim() || null) ??
      KIND_TAG[card.kind ?? ''] ??
      'Card',
    details,
  };
}

/**
 * The pass's `pass.json`, as a plain object. Pure: no I/O, no signing, so it can be asserted on.
 *
 * ## The layout — the share face, in Wallet's vocabulary
 *
 *     ┌──────────────────────────────────┐
 *     │ [mark]  FERNWOOD STUDIO          │  brand mark + the company
 *     │                                  │
 *     │ HEAD OF PARTNERSHIPS      ( ◯ )  │  the role, small, above…
 *     │ Priyanka Raghunathan             │  …the name, large; round portrait right
 *     │                                  │
 *     │ WORK MOBILE                      │  up to two detail pairs
 *     │ +91 98201 15577                  │
 *     │ WORK EMAIL                       │
 *     │ priyanka@fernwood.example        │
 *     │            ▓▓▓▓▓▓                │  Wallet draws the QR on its own white plate
 *     └──────────────────────────────────┘
 *
 * **Event-ticket style**, deliberately: of Wallet's styles it is the one that accepts a
 * full-bleed `background` image, which is how the card's two-colour gradient reaches the pass
 * (a generic pass can only paint one flat colour). It also keeps the portrait thumbnail.
 *
 * What Wallet will not do, and so what is not here: the outer rounded corners and the white QR
 * plate are drawn by iOS; a pill-shaped company chip and a monospaced link row are not fields
 * Wallet can style (the link is on the back of the pass instead).
 */
export function buildPassJson(
  card: PassCard,
  owner: PassOwner,
  config: PassConfig,
  fields: readonly PassCardField[] = [],
): Record<string, unknown> {
  const ownerName =
    [owner.firstName, owner.lastName].filter(Boolean).join(' ') || card.name;
  const publicUrl = `${config.shareBaseUrl}/c/${card.publicToken}`;
  const theme = resolvePassTheme(
    card.groundHex,
    card.paletteId,
    card.templateId,
  );
  const { company, role, details } = selectPassContent(card, fields);

  const detailField = (f: PassCardField | undefined, key: string) =>
    f ? [{ key, label: f.label, value: f.value }] : [];

  return {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeId,
    teamIdentifier: config.teamId,
    organizationName: config.orgName,
    description: 'ContactBook digital card',
    serialNumber: card.id,
    authenticationToken: deriveAuthToken(config.authSecret, card.id),
    webServiceURL: config.webServiceUrl,
    logoText: (company ?? config.orgName).toUpperCase(),
    backgroundColor: theme.backgroundColor,
    foregroundColor: theme.foregroundColor,
    labelColor: theme.labelColor,
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: publicUrl,
        messageEncoding: 'iso-8859-1',
        altText: 'Scan to open card',
      },
    ],
    eventTicket: {
      primaryFields: [{ key: 'name', label: role, value: ownerName }],
      secondaryFields: detailField(details[0], 'detail1'),
      auxiliaryFields: detailField(details[1], 'detail2'),
      backFields: [
        { key: 'card_name', label: 'Card', value: card.name },
        { key: 'link', label: 'Card link', value: publicUrl },
      ],
    },
    ...(card.archivedAt ? { voided: true } : {}),
  };
}

/**
 * Builds a signed .pkpass for a card: the `pass.json`, the fixed brand images (icon, plus the logo mark coloured per card),
 * the card's gradient background, and a per-owner portrait thumbnail. Async only because of the portrait (a photo fetch and an
 * image render); a missing or slow photo falls back to a silhouette and never fails the pass.
 */
export async function buildPass(
  card: PassCard,
  owner: PassOwner,
  config: PassConfig,
  fields: readonly PassCardField[] = [],
): Promise<Buffer> {
  const passJson = buildPassJson(card, owner, config, fields);
  const theme = resolvePassTheme(
    card.groundHex,
    card.paletteId,
    card.templateId,
  );

  const photo = owner.photoUrl ? await fetchPhoto(owner.photoUrl) : null;
  const thumbnails = await renderThumbnails(photo, theme);
  const backgrounds = await renderBackgrounds(theme);
  const logos = await renderLogos(theme);

  const { ICON, ICON_2X, ICON_3X } = getAssets();

  // PKPass constructor: (fileBuffers, certificates, overrideProps)
  const pass = new PKPass(
    {
      'pass.json': Buffer.from(JSON.stringify(passJson)),
      'icon.png': ICON,
      'icon@2x.png': ICON_2X,
      'icon@3x.png': ICON_3X,
      ...logos,
      ...thumbnails,
      ...backgrounds,
    },
    {
      wwdr: config.wwdrCertPem,
      signerCert: config.signerCertPem,
      signerKey: config.signerKeyPem,
      signerKeyPassphrase: config.signerKeyPassphrase,
    },
  );

  return pass.getAsBuffer();
}
