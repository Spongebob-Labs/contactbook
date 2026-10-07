import {
  GOOGLE_WALLET_CARD_SELECT,
  buildPassClass,
  buildPassObject,
  passClassId,
  passLogo,
  passObjectId,
  type GoogleWalletCard,
} from './google-wallet-pass.util';
import { resolveBackgroundHex } from '../wallet/pass-colors.util';

const IDS = {
  classId: '3388000000022000000.card',
  objectId: '3388000000022000000.card-1',
};

const card = (over: Partial<GoogleWalletCard> = {}): GoogleWalletCard => ({
  id: 'card-1',
  name: 'Work',
  headline: 'Head of Design',
  publicToken: 'tok3nPublic',
  archivedAt: null,
  templateId: 'meridian',
  paletteId: 'emerald',
  groundHex: null,
  user: { firstName: 'Maya', lastName: 'Lauren' },
  ...over,
});

describe('pass IDs', () => {
  it('are deterministic: issuer.suffix and issuer.cardId', () => {
    expect(passClassId('3388', 'card')).toBe('3388.card');
    expect(passObjectId('3388', '592a51af-0c1d')).toBe('3388.592a51af-0c1d');
  });
});

describe('buildPassClass', () => {
  it('carries the class id and a row layout, and nothing about any card', () => {
    const cls = buildPassClass(IDS.classId);
    expect(cls.id).toBe(IDS.classId);
    expect(JSON.stringify(cls)).toContain("object.textModulesData['headline']");
  });
});

describe('passLogo', () => {
  it('is the ContactBook mark, a public https image on the share origin, described for screen readers', () => {
    const logo = passLogo('#142C63', 'https://app.example/');
    expect(logo).toEqual({
      sourceUri: { uri: 'https://app.example/brand/pass-logo-gold.png' },
      contentDescription: {
        defaultValue: { language: 'en-US', value: 'ContactBook' },
      },
    });
  });

  it('uses the gold mark where the ground clears 3:1 against it, the dark ink where it does not', () => {
    const uri = (hex: string) =>
      (passLogo(hex, 'https://app.example').sourceUri as { uri: string }).uri;
    expect(uri('#142C63')).toMatch(/pass-logo-gold\.png$/); // sapphire
    expect(uri('#181A1F')).toMatch(/pass-logo-gold\.png$/); // onyx
    expect(uri('#E3A28A')).toMatch(/pass-logo-ink\.png$/); // clay
    expect(uri('#E8E8E8')).toMatch(/pass-logo-ink\.png$/); // a light grey
  });

  it('puts the logo on every pass object', () => {
    const pass = buildPassObject(card(), IDS, 'https://app.example');
    expect(pass.logo).toBeDefined();
  });
});

describe('buildPassObject', () => {
  it('carries owner name, card name, headline and the QR link — in Google’s shapes', () => {
    const pass = buildPassObject(card(), IDS, 'https://app.example/');
    expect(pass).toEqual({
      id: IDS.objectId,
      classId: IDS.classId,
      genericType: 'GENERIC_OTHER',
      state: 'ACTIVE',
      cardTitle: { defaultValue: { language: 'en-US', value: 'Work' } },
      header: { defaultValue: { language: 'en-US', value: 'Maya Lauren' } },
      subheader: {
        defaultValue: { language: 'en-US', value: 'Head of Design' },
      },
      hexBackgroundColor: resolveBackgroundHex(null, 'emerald', 'meridian'),
      logo: passLogo(
        resolveBackgroundHex(null, 'emerald', 'meridian'),
        'https://app.example/',
      ),
      barcode: {
        type: 'QR_CODE',
        value: 'https://app.example/c/tok3nPublic',
        alternateText: 'Scan to open card',
      },
      textModulesData: [
        { id: 'headline', header: 'TITLE', body: 'Head of Design' },
        { id: 'card', header: 'CARD', body: 'Work' },
        {
          id: 'link',
          header: 'CARD LINK',
          body: 'https://app.example/c/tok3nPublic',
        },
      ],
    });
  });

  it('has no way to carry a field value or a phone number', () => {
    // The select is the whole input. If a `fields` relation or a phone column
    // is ever added here, this is the test that has to be argued with.
    expect(Object.keys(GOOGLE_WALLET_CARD_SELECT).sort()).toEqual([
      'archivedAt',
      'groundHex',
      'headline',
      'id',
      'name',
      'paletteId',
      'publicToken',
      'templateId',
      'user',
    ]);
    expect(GOOGLE_WALLET_CARD_SELECT.user).toEqual({
      select: { firstName: true, lastName: true },
    });

    // And a row that somehow arrives with more on it still prints none of it.
    const overfetched = {
      ...card(),
      fields: [{ field: { type: 'PHONE', value: '+15555550100' } }],
      user: {
        firstName: 'Maya',
        lastName: 'Lauren',
        phoneE164: '+15555550199',
      },
    } as GoogleWalletCard;
    const json = JSON.stringify(
      buildPassObject(overfetched, IDS, 'https://app.example'),
    );
    expect(json).not.toContain('+1555');
  });

  it('uses the same ground as the card and the Apple pass: free colour, then palette, then template', () => {
    const hex = (over: Partial<GoogleWalletCard>) =>
      buildPassObject(card(over), IDS, 'https://app.example')
        .hexBackgroundColor;
    expect(hex({ groundHex: '#AB12CD' })).toBe('#AB12CD');
    expect(hex({ paletteId: 'onyx' })).toBe('#181A1F');
    expect(hex({ paletteId: null, templateId: 'marigold' })).toBe(
      resolveBackgroundHex(null, null, 'marigold'),
    );
  });

  it('is EXPIRED for an archived card', () => {
    const pass = buildPassObject(
      card({ archivedAt: new Date('2026-10-01T00:00:00Z') }),
      IDS,
      'https://app.example',
    );
    expect(pass.state).toBe('EXPIRED');
  });

  it('leaves the headline out entirely when the card has none', () => {
    for (const headline of [null, '', '   ']) {
      const pass = buildPassObject(
        card({ headline }),
        IDS,
        'https://app.example',
      );
      expect(pass).not.toHaveProperty('subheader');
      expect(pass.textModulesData).toEqual([
        { id: 'card', header: 'CARD', body: 'Work' },
        {
          id: 'link',
          header: 'CARD LINK',
          body: 'https://app.example/c/tok3nPublic',
        },
      ]);
    }
  });

  it('falls back to the card name when the owner has no name yet', () => {
    const pass = buildPassObject(
      card({ user: { firstName: null, lastName: '  ' } }),
      IDS,
      'https://app.example',
    );
    expect(pass.header).toEqual({
      defaultValue: { language: 'en-US', value: 'Work' },
    });
  });
});
