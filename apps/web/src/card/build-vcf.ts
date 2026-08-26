/**
 * `buildVcf` — the vCard 3.0 writer (spec §6.7, §6.9, §7.3, RFC 2426).
 *
 * ## The rule this file exists to enforce
 * **A card with no mapped fields throws. It does not return a stub.** The old build shipped
 * card `5a286f9e` with zero mappings and produced a **73-byte** `.vcf` carrying `FN` and `N`
 * and nothing else — a file that looked like a successful save and gave the scanner no way
 * to contact anyone. It shipped silently because the requested field types were a *filter*
 * over attached fields rather than a data source, so asking for everything on a card with
 * nothing attached yielded a name-only file.
 *
 * `EmptyCardError` closes that path here; the UI closes it before it is ever reached
 * (T23 disables Save, T18 does not render the button). Making this "forgiving" re-opens the
 * exact bug this run exists to close — see `canBuildVcf` for the guard callers should read.
 *
 * ## What it is, mechanically
 * A pure function from one `ResolvedCard` to one string. It re-derives **nothing**: every
 * value comes from the object it is handed, which is what makes invariant I-5 provable —
 * the preview and the payload cannot disagree because there is only one object.
 *
 * ## Format notes
 * - vCard 3.0, CRLF line endings, closing CRLF after `END:VCARD` (RFC 2426 §2.1.1 — every
 *   content line ends with one). **A reader splitting on CRLF gets a trailing `''`.**
 * - The document is UTF-8. vCard 3.0's default charset is already UTF-8, so no `CHARSET`
 *   parameter is emitted — §6.7's worked output carries none either.
 * - Line order is **vCard property order**, not field order. §6.7's example pins it: a card
 *   whose fields resolve PHONE-first still writes `TITLE` first.
 */

import { EmptyCardError } from "@/card/errors";
import {
  formatAddressOneLine,
  formatEmailDisplay,
  maskTail,
  parseSocialLink,
  toE164,
} from "@/lib/format";
import type { AddressDetail, FieldType, ResolvedCard, ResolvedField } from "@/types/domain";

const CRLF = "\r\n";

/** RFC 2426 §2.6: a content line SHOULD NOT be longer than 75 **octets**, fold excluded. */
export const MAX_LINE_OCTETS = 75;

/** §6.9: the blob type behind "Save to contacts". */
export const VCARD_MIME_TYPE = "text/vcard;charset=utf-8";

/**
 * The provenance footer of §6.7, split out so a reader (and AC-22's round-trip assertion)
 * can tell the one constant `NOTE` apart from a `NOTE` that came from a `TEXT` field.
 */
export const VCARD_NOTE_PREFIX = "Saved from Contact Book — ";

const ENCODER = new TextEncoder();
const octets = (value: string): number => ENCODER.encode(value).length;

/* ── the FieldType → vCard property table ───────────────────────────────────────────── */

interface VcfProperty {
  /** The property name, without parameters. */
  name: string;
  /** Emission order. §6.7's worked output pins ranks 1–9; the rest follow its shape. */
  rank: number;
}

/**
 * Typed `Record<FieldType, …>` on purpose: a 22nd field type, or a deleted row, is a
 * **compile** error rather than a value that silently vanishes from every downloaded file.
 *
 * Types without a vCard 3.0 equivalent take an `X-CB-` extension rather than being dropped
 * or crammed into `NOTE`. Each signature is distinct — `TEL` is disambiguated by its `TYPE`
 * parameter — so the file can be read back to the exact set of field types that produced it,
 * which is what AC-22 asserts.
 *
 * `PHOTO` is `null`: the avatar slot consumes it and it is never a row (§6.6), so it is in
 * neither `ResolvedCard.fields` nor the file.
 */
const PROPERTIES: Record<FieldType, VcfProperty | null> = {
  JOB_TITLE: { name: "TITLE", rank: 1 },
  COMPANY: { name: "ORG", rank: 2 },
  DEPARTMENT: { name: "X-CB-DEPARTMENT", rank: 3 },
  PHONE: { name: "TEL", rank: 4 },
  LANDLINE: { name: "TEL", rank: 5 },
  FAX: { name: "TEL", rank: 6 },
  EMAIL: { name: "EMAIL", rank: 7 },
  ADDRESS: { name: "ADR", rank: 8 },
  URL: { name: "URL", rank: 9 },
  SOCIAL_LINK: { name: "X-SOCIALPROFILE", rank: 10 },
  DATE: { name: "X-CB-DATE", rank: 11 },
  REG_NUMBER: { name: "X-CB-REG-NUMBER", rank: 12 },
  RELATION: { name: "X-CB-RELATION", rank: 13 },
  STATUS: { name: "X-CB-STATUS", rank: 14 },
  LOCATION_TRACKING: { name: "X-CB-LOCATION", rank: 15 },
  BANK_ACCOUNT: { name: "X-CB-BANK-ACCOUNT", rank: 16 },
  DIGITAL_WALLET: { name: "X-CB-DIGITAL-WALLET", rank: 17 },
  CRYPTO_WALLET: { name: "X-CB-CRYPTO-WALLET", rank: 18 },
  CUSTOM: { name: "X-CB-CUSTOM", rank: 19 },
  /** Last, so a user's own notes sit directly above the provenance footer. */
  TEXT: { name: "NOTE", rank: 20 },
  PHOTO: null,
};

/** The `TYPE` parameter that keeps the three telephone-shaped types distinguishable. */
const TEL_TYPE: Partial<Record<FieldType, string>> = {
  PHONE: "CELL",
  LANDLINE: "VOICE",
  FAX: "FAX",
};

const FINANCIAL_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  "BANK_ACCOUNT",
  "DIGITAL_WALLET",
  "CRYPTO_WALLET",
]);

/**
 * §7.3 never renders a coordinate on any surface, and a `.vcf` is a surface. The value of a
 * `LOCATION_TRACKING` field is a status string; a coordinate-shaped one is a data fault, and
 * dropping the property is the only outcome that cannot leak a position.
 */
const COORDINATE_PAIR = /^[-+]?\d{1,3}(?:\.\d+)?\s*,\s*[-+]?\d{1,3}(?:\.\d+)?$/;

/* ── escaping, folding, parameters ──────────────────────────────────────────────────── */

/**
 * RFC 2426 §2: within a value, `\` `;` `,` and newlines are escaped. The backslash goes
 * first — reversing the order would turn a literal `,` into `\,` and then into `\\,`.
 */
function escapeValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** RFC 2425 param values may not carry `;` `:` `,` or a quote. Keep it conservative. */
function escapeParam(value: string): string {
  return value.replace(/[^A-Za-z0-9 ._+-]/g, "");
}

/**
 * Fold at 75 **octets**, not 75 characters (§6.7, §11 E-16).
 *
 * The continuation marker is CRLF plus a single space, and that space is part of the
 * physical line, so a continuation carries one octet less content than the first line.
 * Iteration is by code point (`for…of` on a string), so a multi-byte character can never be
 * cut in half — a byte-wise folder produces mojibake that only shows up in non-ASCII names.
 *
 * Unfolding happens before unescaping, so a fold landing inside an escape sequence is legal.
 */
function foldLine(line: string): string {
  if (octets(line) <= MAX_LINE_OCTETS) return line;

  const chunks: string[] = [];
  let current = "";
  let currentOctets = 0;
  let budget = MAX_LINE_OCTETS;

  for (const character of line) {
    const size = octets(character);
    if (currentOctets + size > budget) {
      chunks.push(current);
      current = "";
      currentOctets = 0;
      budget = MAX_LINE_OCTETS - 1; // the leading space of a continuation line
    }
    current += character;
    currentOctets += size;
  }
  chunks.push(current);

  return chunks.join(`${CRLF} `);
}

/* ── values ─────────────────────────────────────────────────────────────────────────── */

/**
 * §6.7: "included, but financial values masked … matches what the card displays."
 *
 * The card displays the three financial types **and** any `isSensitive` field masked, with
 * no reveal control on a public page (§6.6, §7.3, AC-33). Masking the same set here is what
 * makes "matches what the card displays" true rather than aspirational, and it fails safe:
 * the downloaded file can never carry more than the page showed.
 *
 * One predicate on purpose — if that reading is ever reversed, this is the only line to change.
 */
function shouldMask(field: ResolvedField): boolean {
  return FINANCIAL_TYPES.has(field.type) || field.isSensitive;
}

/**
 * The value as a `.vcf` should carry it — canonical, not display-formatted. Telephone
 * numbers are E.164 and emails are lowercased (both pinned by §6.7's worked output), but a
 * URL keeps its full text rather than §6.6's 34-character display clamp: a truncated URL in
 * an address book is a broken link.
 */
function canonicalValue(field: ResolvedField): string {
  const raw = field.value.trim();

  switch (field.type) {
    case "PHONE":
    case "LANDLINE":
    case "FAX":
      return toE164(raw);
    case "EMAIL":
      return formatEmailDisplay(raw);
    default:
      return raw;
  }
}

function isAddressDetail(field: ResolvedField): AddressDetail | null {
  return field.detail?.kind === "ADDRESS" ? field.detail : null;
}

/**
 * ADR's seven components, in RFC 2426 order:
 * po-box ; extended ; street ; locality ; region ; postal-code ; country.
 *
 * A masked address collapses into the street component so the property still parses with
 * seven parts — an ADR with a different arity is a corrupt line, not a redacted one.
 */
function addressComponents(field: ResolvedField, masked: boolean): string[] {
  const detail = isAddressDetail(field);

  if (masked) {
    const flat = detail === null ? field.value.trim() : formatAddressOneLine(detail);
    return ["", "", maskTail(flat), "", "", "", ""];
  }
  if (detail === null) {
    return ["", "", field.value.trim(), "", "", "", ""];
  }
  return [
    "",
    detail.line2 ?? "",
    detail.line1,
    detail.city,
    detail.region ?? "",
    detail.postalCode ?? "",
    detail.country,
  ];
}

/** The parameter list for a property, already escaped. Empty when the property takes none. */
function parametersFor(field: ResolvedField): string {
  switch (field.type) {
    case "PHONE":
    case "LANDLINE":
    case "FAX":
      return `;TYPE=${TEL_TYPE[field.type]}`;
    case "EMAIL":
      return ";TYPE=INTERNET";
    case "ADDRESS":
      return ";TYPE=INTL";
    case "SOCIAL_LINK":
      // §11 E-23: an unrecognised host falls back to the hostname, never to an empty label.
      return `;TYPE=${escapeParam(parseSocialLink(field.value).platform)}`;
    default:
      return "";
  }
}

/**
 * One content line for one field, or `null` when the field must not produce a property.
 *
 * §6.7: a blank value is **omitted**, never emitted as `TEL;TYPE=CELL:` with nothing after
 * the colon — an empty property is worse than a missing one, because it imports as a blank
 * row in the reader's address book.
 */
function lineFor(field: ResolvedField): string | null {
  const property = PROPERTIES[field.type];
  if (property === null) return null;

  const value = canonicalValue(field);
  if (value.length === 0) return null;

  if (field.type === "LOCATION_TRACKING" && COORDINATE_PAIR.test(value)) return null;

  const masked = shouldMask(field);
  const name = `${property.name}${parametersFor(field)}`;

  if (field.type === "ADDRESS") {
    return `${name}:${addressComponents(field, masked).map(escapeValue).join(";")}`;
  }
  return `${name}:${escapeValue(masked ? maskTail(value) : value)}`;
}

/* ── the name components ────────────────────────────────────────────────────────────── */

/**
 * `ResolvedCard` carries a composed `fullName` and no separate given/family (§6.4), so `N`
 * is reconstructed by splitting on the last space. That reproduces §6.7's worked output
 * exactly and is right for the overwhelming majority of names, but it is **lossy for a
 * multi-token surname** — "Arjun Venkataraghavan-Balasubramanian Iyer" yields a family name
 * of "Iyer". Fixing it properly means carrying `firstName`/`lastName` on `ResolvedCard`,
 * which is a §6.4 change, so it is recorded here rather than guessed at.
 *
 * A mononym goes in the family component, which is what address books expect.
 */
function nameComponents(displayName: string): { family: string; given: string } {
  const parts = displayName.split(/\s+/).filter((part) => part.length > 0);

  if (parts.length === 0) return { family: "", given: "" };
  if (parts.length === 1) return { family: parts[0], given: "" };
  return { family: parts[parts.length - 1], given: parts.slice(0, -1).join(" ") };
}

/** RFC 2426 requires a non-empty `FN`, so an unnamed user falls back to the card's name. */
function displayNameOf(resolved: ResolvedCard): string {
  return resolved.fullName.trim() || resolved.cardName.trim() || resolved.slug;
}

/* ── the public surface ─────────────────────────────────────────────────────────────── */

/**
 * Whether this card has anything to write — **the guard every caller reads** (§11 E-01/E-02).
 *
 * The builder disables Save on `false` and explains why; the public card does not render
 * "Save to contacts" at all. Both must consult this rather than counting fields themselves,
 * so there is exactly one definition of "this card shares nothing".
 *
 * A links-only card is **not** empty: it shares links. `fieldCount` counts `fields` and
 * `socialFields` together (§6.4) and is the number E-01's warning bar reports.
 */
export function canBuildVcf(resolved: ResolvedCard): boolean {
  return resolved.fieldCount > 0;
}

/** §6.9: the `download` attribute. The slug is the fallback because it is unique and safe. */
export function vcfFileName(resolved: ResolvedCard): string {
  const clean = (value: string): string =>
    value.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

  return `${clean(resolved.fullName) || resolved.slug}.vcf`;
}

/**
 * Write the vCard for a resolved card.
 *
 * @throws {EmptyCardError} when the card maps no fields — see the module note. Callers must
 * gate on `canBuildVcf` and never catch this to produce a fallback file.
 */
export function buildVcf(resolved: ResolvedCard): string {
  if (!canBuildVcf(resolved)) {
    throw new EmptyCardError(resolved.cardId, resolved.slug);
  }

  const displayName = displayNameOf(resolved);
  const { family, given } = nameComponents(displayName);

  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    // family ; given ; additional ; prefix ; suffix
    `N:${[family, given, "", "", ""].map(escapeValue).join(";")}`,
    `FN:${escapeValue(displayName)}`,
  ];

  // Property order, not field order (§6.7). The index keeps the sort total, so two fields of
  // the same type stay in the deterministic order `resolveCard` put them in (§6.4).
  const entries = [...resolved.fields, ...resolved.socialFields]
    .map((field, index) => ({ field, index }))
    .sort((a, b) => {
      const rankA = PROPERTIES[a.field.type]?.rank ?? Number.MAX_SAFE_INTEGER;
      const rankB = PROPERTIES[b.field.type]?.rank ?? Number.MAX_SAFE_INTEGER;
      return rankA === rankB ? a.index - b.index : rankA - rankB;
    });

  for (const { field } of entries) {
    const line = lineFor(field);
    if (line !== null) lines.push(line);
  }

  lines.push(`NOTE:${escapeValue(`${VCARD_NOTE_PREFIX}${resolved.qrPayload}`)}`);
  lines.push("END:VCARD");

  return `${lines.map(foldLine).join(CRLF)}${CRLF}`;
}
