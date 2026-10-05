import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  buildPass,
  buildPassJson,
  type PassCard,
  selectPassContent,
  type PassCardField,
  type PassConfig,
  type PassOwner,
} from './pass-builder';

const CARD: PassCard = {
  id: 'card-1',
  name: 'Work',
  headline: 'Head of Partnerships',
  publicToken: 'tok123',
  archivedAt: null,
  templateId: 'meridian',
  paletteId: 'ivory',
  groundHex: null,
};
const OWNER: PassOwner = { firstName: 'Priyanka', lastName: 'Raghunathan' };

const BASE_CONFIG: PassConfig = {
  passTypeId: 'pass.test.contactbook',
  teamId: 'TEAM123456',
  orgName: 'ContactBook',
  webServiceUrl: 'https://api.example.test/api/wallet',
  signerCertPem: '',
  signerKeyPem: '',
  signerKeyPassphrase: undefined,
  wwdrCertPem: '',
  authSecret: 'x'.repeat(40),
  shareBaseUrl: 'https://cards.example.test',
};

type Field = { key: string; label?: string; value: string };
type Ticket = {
  primaryFields: Field[];
  secondaryFields: Field[];
  auxiliaryFields: Field[];
  backFields: Field[];
};

const FIELDS: PassCardField[] = [
  { type: 'COMPANY', label: 'Company', value: 'Fernwood Studio' },
  { type: 'JOB_TITLE', label: 'Role', value: 'Head of Partnerships' },
  { type: 'EMAIL', label: 'Work email', value: 'priyanka@fernwood.example' },
  { type: 'PHONE', label: 'Work mobile', value: '+91 98201 15577' },
  {
    type: 'ADDRESS',
    label: 'Studio',
    value: '4th Floor, Raheja Titanium, Mumbai',
  },
  { type: 'URL', label: 'Website', value: 'fernwood.example' },
];

describe('selectPassContent — the same rules as the web share face', () => {
  it('picks the company, the job title, and a number then an email (not the order they were stored)', () => {
    const c = selectPassContent(CARD, FIELDS);
    expect(c.company).toBe('Fernwood Studio');
    expect(c.role).toBe('Head of Partnerships');
    expect(c.details.map((d) => d.label)).toEqual([
      'Work mobile',
      'Work email',
    ]);
  });

  it('never shows more than two details, and never an address or a financial field', () => {
    const c = selectPassContent(CARD, [
      ...FIELDS,
      { type: 'BANK_ACCOUNT', label: 'Bank', value: '50100412345678' },
      { type: 'PHONE', label: 'Second phone', value: '+91 99999 00000' },
    ]);
    expect(c.details).toHaveLength(2);
    const text = JSON.stringify(c);
    expect(text).not.toContain('Raheja');
    expect(text).not.toContain('50100412345678');
  });

  it('falls back to a website only when there is no second handle, owner order breaking ties', () => {
    const c = selectPassContent(CARD, [
      { type: 'PHONE', label: 'A', value: '1' },
      { type: 'PHONE', label: 'B', value: '2' },
      { type: 'URL', label: 'Site', value: 'x.example' },
    ]);
    expect(c.details.map((d) => d.label)).toEqual(['A', 'B']);
  });

  it('role: the job title, else the headline, else the card type — never empty', () => {
    expect(selectPassContent({ ...CARD, headline: 'Founder' }, []).role).toBe(
      'Founder',
    );
    expect(
      selectPassContent({ ...CARD, headline: null, kind: 'WORK' }, []).role,
    ).toBe('Business');
    expect(
      selectPassContent({ ...CARD, headline: '  ', kind: 'PERSONAL' }, []).role,
    ).toBe('Personal');
    expect(
      selectPassContent({ ...CARD, headline: null, kind: undefined }, []).role,
    ).toBe('Card');
    expect(
      selectPassContent({ ...CARD, headline: 'Founder' }, FIELDS).role,
    ).toBe('Head of Partnerships'); // the field wins over the headline
  });

  it('ignores blank values', () => {
    const c = selectPassContent(CARD, [
      { type: 'PHONE', label: 'Mobile', value: '   ' },
    ]);
    expect(c.details).toEqual([]);
  });
});

describe('buildPassJson — the layout', () => {
  const json = buildPassJson(CARD, OWNER, BASE_CONFIG, FIELDS);
  const ticket = json.eventTicket as Ticket;

  it('is an event ticket (the style that accepts a full-bleed gradient background), not generic', () => {
    expect(json).toHaveProperty('eventTicket');
    expect(json).not.toHaveProperty('generic');
  });

  it('puts the role as the small tag above the owner name', () => {
    expect(ticket.primaryFields).toEqual([
      {
        key: 'name',
        label: 'Head of Partnerships',
        value: 'Priyanka Raghunathan',
      },
    ]);
  });

  it('prints the two detail pairs, label above value', () => {
    expect(ticket.secondaryFields).toEqual([
      { key: 'detail1', label: 'Work mobile', value: '+91 98201 15577' },
    ]);
    expect(ticket.auxiliaryFields).toEqual([
      {
        key: 'detail2',
        label: 'Work email',
        value: 'priyanka@fernwood.example',
      },
    ]);
  });

  it('shows the company, uppercased, beside the logo — and nothing when there is none', () => {
    expect(json.logoText).toBe('FERNWOOD STUDIO');
    const none = buildPassJson(CARD, OWNER, BASE_CONFIG, []);
    expect(none).not.toHaveProperty('logoText');
  });

  it('has no empty rows when the card shares no details', () => {
    const bare = buildPassJson(CARD, OWNER, BASE_CONFIG, [])
      .eventTicket as Ticket;
    expect(bare.secondaryFields).toEqual([]);
    expect(bare.auxiliaryFields).toEqual([]);
    expect(bare.primaryFields[0].label).toBe('Head of Partnerships'); // the headline
  });

  it("falls back to the card's name when the owner has no name", () => {
    const t = buildPassJson(
      CARD,
      { firstName: null, lastName: null },
      BASE_CONFIG,
      FIELDS,
    ).eventTicket as Ticket;
    expect(t.primaryFields[0].value).toBe('Work');
  });

  it("uses the card's own colours: ground, ink and the muted second ink", () => {
    expect(json.backgroundColor).toBe('rgb(231, 214, 186)'); // ivory #E7D6BA
    expect(json.foregroundColor).toBe('rgb(15, 17, 20)');
    expect(json.labelColor).toBe('rgb(79, 66, 41)'); // inkSoft #4F4229
  });

  it("encodes the card's public link in the QR, with the alt text", () => {
    expect(json.barcodes).toEqual([
      {
        format: 'PKBarcodeFormatQR',
        message: 'https://cards.example.test/c/tok123',
        messageEncoding: 'iso-8859-1',
        altText: 'Scan to open card',
      },
    ]);
  });

  it('keeps the link and card name on the back of the pass', () => {
    expect(ticket.backFields.map((f) => f.key)).toEqual(['card_name', 'link']);
  });

  it('is voided for an archived card and not otherwise', () => {
    expect(json).not.toHaveProperty('voided');
    expect(
      buildPassJson({ ...CARD, archivedAt: new Date() }, OWNER, BASE_CONFIG),
    ).toMatchObject({ voided: true });
  });
});

/** The names of the files in a zip, from its central directory. */
function zipEntryNames(zip: Buffer): string[] {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const nameLen = zip.readUInt16LE(offset + 28);
    const extraLen = zip.readUInt16LE(offset + 30);
    const commentLen = zip.readUInt16LE(offset + 32);
    names.push(zip.toString('utf8', offset + 46, offset + 46 + nameLen));
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

describe('buildPass — a real signed pkpass', () => {
  let dir: string;
  let config: PassConfig;

  beforeAll(() => {
    // Throwaway self-signed key + cert. The WWDR slot just needs any cert; nothing here talks to Apple.
    dir = mkdtempSync(join(tmpdir(), 'wallet-spec-'));
    const run = (args: string[]) =>
      execFileSync('openssl', args, { stdio: 'pipe' });
    const mk = (name: string) => {
      run([
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        join(dir, `${name}.key`),
        '-out',
        join(dir, `${name}.pem`),
        '-days',
        '2',
        '-subj',
        `/CN=${name}`,
      ]);
    };
    mk('signer');
    mk('wwdr');
    config = {
      ...BASE_CONFIG,
      signerCertPem: readFileSync(join(dir, 'signer.pem'), 'utf8'),
      signerKeyPem: readFileSync(join(dir, 'signer.key'), 'utf8'),
      wwdrCertPem: readFileSync(join(dir, 'wwdr.pem'), 'utf8'),
    };
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('contains every file Wallet needs, including the portrait and gradient at all three sizes', async () => {
    const buffer = await buildPass(CARD, OWNER, config, FIELDS);
    const names = zipEntryNames(buffer);
    for (const required of [
      'pass.json',
      'manifest.json',
      'signature',
      'icon.png',
      'icon@2x.png',
      'icon@3x.png',
      'logo.png',
      'logo@2x.png',
      'logo@3x.png',
      'thumbnail.png',
      'thumbnail@2x.png',
      'thumbnail@3x.png',
      'background.png',
      'background@2x.png',
      'background@3x.png',
    ]) {
      expect(names).toContain(required);
    }
  }, 30000);

  it('still issues the pass when the owner has no photo, or the photo cannot be fetched', async () => {
    const withBadPhoto = await buildPass(
      CARD,
      { ...OWNER, photoUrl: 'http://not-https.example.test/p.jpg' },
      config,
    );
    expect(zipEntryNames(withBadPhoto)).toContain('thumbnail@3x.png');
  }, 30000);

  it('ships real PNG brand assets (they were JPEG data with a .png name)', async () => {
    for (const f of [
      'icon.png',
      'icon@2x.png',
      'icon@3x.png',
      'logo-mark.png',
    ]) {
      const meta = await sharp(join(__dirname, 'assets', f)).metadata();
      expect(meta.format).toBe('png');
    }
    const mark = await sharp(
      join(__dirname, 'assets', 'logo-mark.png'),
    ).metadata();
    expect(mark.hasAlpha).toBe(true); // a transparent mask, not a picture with a background
  });
});
