import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PKPass } from 'passkit-generator';
import {
  resolveBackgroundHex,
  resolvePassColors,
  toPassRgb,
} from './pass-colors.util';
import { deriveAuthToken } from './pass-auth.util';

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
let LOGO: Buffer | undefined;
let LOGO_2X: Buffer | undefined;

function getAssets() {
  ICON ??= loadAsset('icon.png');
  ICON_2X ??= loadAsset('icon@2x.png');
  ICON_3X ??= loadAsset('icon@3x.png');
  LOGO ??= loadAsset('logo.png');
  LOGO_2X ??= loadAsset('logo@2x.png');
  return { ICON, ICON_2X, ICON_3X, LOGO, LOGO_2X };
}

export interface PassCard {
  id: string;
  name: string;
  headline: string | null;
  publicToken: string;
  archivedAt: Date | null;
  templateId: string;
  paletteId: string | null;
  groundHex: string | null;
}

export interface PassOwner {
  firstName: string | null;
  lastName: string | null;
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

/**
 * Builds a signed .pkpass for a card. Pure function of card + owner + config;
 * no Prisma calls inside. Returns a Buffer ready to stream as
 * application/vnd.apple.pkpass.
 */
export function buildPass(
  card: PassCard,
  owner: PassOwner,
  config: PassConfig,
): Buffer {
  const ownerName = [owner.firstName, owner.lastName]
    .filter(Boolean)
    .join(' ');

  const publicUrl = `${config.shareBaseUrl}/c/${card.publicToken}`;

  const bgHex = resolveBackgroundHex(
    card.groundHex,
    card.paletteId,
    card.templateId,
  );
  const { foregroundColor, labelColor } = resolvePassColors(bgHex);

  const authToken = deriveAuthToken(config.authSecret, card.id);

  const passJson: Record<string, unknown> = {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeId,
    teamIdentifier: config.teamId,
    organizationName: config.orgName,
    description: 'ContactBook digital card',
    serialNumber: card.id,
    authenticationToken: authToken,
    webServiceURL: config.webServiceUrl,
    logoText: card.name,
    backgroundColor: toPassRgb(bgHex),
    foregroundColor,
    labelColor,
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: publicUrl,
        messageEncoding: 'iso-8859-1',
        altText: 'Scan to open card',
      },
    ],
    generic: {
      primaryFields: [{ key: 'name', label: 'NAME', value: ownerName }],
      secondaryFields: [
        { key: 'headline', label: 'TITLE', value: card.headline ?? '' },
      ],
      backFields: [{ key: 'link', label: 'Card link', value: publicUrl }],
    },
    ...(card.archivedAt ? { voided: true } : {}),
  };

  const { ICON, ICON_2X, ICON_3X, LOGO, LOGO_2X } = getAssets();

  // PKPass constructor: (fileBuffers, certificates, overrideProps)
  const pass = new PKPass(
    {
      'pass.json': Buffer.from(JSON.stringify(passJson)),
      'icon.png': ICON,
      'icon@2x.png': ICON_2X,
      'icon@3x.png': ICON_3X,
      'logo.png': LOGO,
      'logo@2x.png': LOGO_2X,
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
