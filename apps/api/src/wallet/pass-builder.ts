import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PKPass } from 'passkit-generator';
import {
  resolveBackgroundHex,
  resolvePassColors,
  toPassRgb,
} from './pass-colors.util';
import { deriveAuthToken } from './pass-auth.util';

// Loaded once at module init — a missing icon is a 500, not a 404.
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

const ICON = loadAsset('icon.png');
const ICON_2X = loadAsset('icon@2x.png');
const ICON_3X = loadAsset('icon@3x.png');
const LOGO = loadAsset('logo.png');
const LOGO_2X = loadAsset('logo@2x.png');

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
