import {
  contrastRatio,
  resolveBackgroundHex,
} from '../wallet/pass-colors.util';
import { BRAND_GOLD } from '../wallet/pass-images';

/**
 * The only card data a Google Wallet pass may carry: owner name, card name,
 * headline and the card's public link. There is deliberately no field list
 * here — a `ProfileField.value` or a phone number has no way into the pass
 * because nothing that builds it is ever handed one.
 */
export interface GoogleWalletCard {
  id: string;
  name: string;
  headline: string | null;
  publicToken: string;
  archivedAt: Date | null;
  templateId: string | null;
  paletteId: string | null;
  groundHex: string | null;
  user: { firstName: string | null; lastName: string | null };
}

/** The Prisma `select` matching {@link GoogleWalletCard} exactly. */
export const GOOGLE_WALLET_CARD_SELECT = {
  id: true,
  name: true,
  headline: true,
  publicToken: true,
  archivedAt: true,
  templateId: true,
  paletteId: true,
  groundHex: true,
  user: { select: { firstName: true, lastName: true } },
} as const;

const LANGUAGE = 'en-US';

/** `{issuerId}.{classSuffix}` — one class for every ContactBook pass. */
export function passClassId(issuerId: string, classSuffix: string): string {
  return `${issuerId}.${classSuffix}`;
}

/**
 * `{issuerId}.{cardId}` — deterministic, so an update always addresses the
 * right object with no lookup table.
 */
export function passObjectId(issuerId: string, cardId: string): string {
  return `${issuerId}.${cardId}`;
}

function localized(value: string) {
  return { defaultValue: { language: LANGUAGE, value } };
}

/**
 * The ContactBook mark for the pass header. Google fetches the image itself, so it must be a
 * public https URL: the two recoloured masks live in the web app's `public/brand/`, next to the
 * logo the site already serves. Same choice as the Apple pass (`logoColor`): gold when the
 * card's ground clears 3:1 against it, the dark ink otherwise. Google crops the logo to a circle,
 * so the files carry padding around the mark.
 */
export function passLogo(
  groundHex: string,
  shareBaseUrl: string,
): Record<string, unknown> {
  const gold = contrastRatio(groundHex, BRAND_GOLD) >= 3;
  const file = gold ? 'pass-logo-gold.png' : 'pass-logo-ink.png';
  return {
    sourceUri: { uri: `${shareBaseUrl.replace(/\/+$/, '')}/brand/${file}` },
    contentDescription: localized('ContactBook'),
  };
}

/** The pass class: only the row layout shared by every pass. No card data. */
export function buildPassClass(classId: string): Record<string, unknown> {
  return {
    id: classId,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['headline']" }],
                },
              },
              endItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['card']" }],
                },
              },
            },
          },
        ],
      },
    },
  };
}

/**
 * The pass object for one card, from its CURRENT data.
 *
 * `cardTitle`, `header` and `subheader` are `LocalizedString`s in the Generic
 * pass API, not bare strings. An archived card is `EXPIRED` — Google's
 * equivalent of Apple's `voided`.
 */
export function buildPassObject(
  card: GoogleWalletCard,
  ids: { classId: string; objectId: string },
  shareBaseUrl: string,
): Record<string, unknown> {
  const ownerName = [card.user.firstName, card.user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  // Same construction as CardsService.toResponseDto() and the Apple pass.
  const shareUrl = `${shareBaseUrl.replace(/\/+$/, '')}/c/${card.publicToken}`;
  const headline = card.headline?.trim() ?? '';
  // The same ground the card and the Apple pass resolve to.
  const background = resolveBackgroundHex(
    card.groundHex,
    card.paletteId,
    card.templateId,
  );

  return {
    id: ids.objectId,
    classId: ids.classId,
    genericType: 'GENERIC_OTHER',
    state: card.archivedAt ? 'EXPIRED' : 'ACTIVE',
    cardTitle: localized(card.name),
    header: localized(ownerName || card.name),
    ...(headline && { subheader: localized(headline) }),
    hexBackgroundColor: background,
    logo: passLogo(background, shareBaseUrl),
    barcode: {
      type: 'QR_CODE',
      value: shareUrl,
      alternateText: 'Scan to open card',
    },
    textModulesData: [
      ...(headline
        ? [{ id: 'headline', header: 'TITLE', body: headline }]
        : []),
      { id: 'card', header: 'CARD', body: card.name },
      { id: 'link', header: 'CARD LINK', body: shareUrl },
    ],
  };
}
