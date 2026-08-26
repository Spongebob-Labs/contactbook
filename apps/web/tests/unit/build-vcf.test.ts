import { describe, expect, it } from "vitest";

import {
  buildVcf,
  canBuildVcf,
  MAX_LINE_OCTETS,
  VCARD_MIME_TYPE,
  VCARD_NOTE_PREFIX,
  vcfFileName,
} from "@/card/build-vcf";
import { EmptyCardError } from "@/card/errors";
import { resolveCard } from "@/card/resolve-card";
import { cardEmptyDemo, cardLedgerDemo, fixtureCards } from "@/fixtures/cards";
import {
  extremeFields,
  extremeGroups,
  LONG_NOTE,
  PUNCTUATED_VALUE,
  XSS_VALUE,
} from "@/fixtures/extremes";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import { fixtureUser } from "@/fixtures/user";
import type { ContactCard, FieldType, ResolvedCard, ResolvedField } from "@/types/domain";

/**
 * `buildVcf` — spec §6.7 (the contract, with a worked output to compare against byte for
 * byte), §6.9 (the download), §7.3 (masking), §11 E-01/E-02, E-07, E-16, E-52, AC-22.
 *
 * ## Why this file is the run's most important regression guard
 * The old build shipped card `5a286f9e` with **zero** field mappings and generated a
 * **73-byte** `.vcf` containing `FN` and `N` and nothing else. It shipped silently because
 * `fieldTypes` was a *filter over attached fields*, not a data source: asking for every type
 * on a card with no mappings yields a name-only file, and the API echoed the requested types
 * back regardless, so an empty card looked correctly configured.
 *
 * The fix has three parts and this file owns one of them: `buildVcf` **throws** rather than
 * producing a stub. (The other two are UI guards — T23 disables Save, T18 does not render
 * the button at all.) Every assertion below that starts "the 73-byte regression" is there
 * to keep this closed.
 */

const CRLF = "\r\n";

function resolve(card: ContactCard): ResolvedCard {
  return resolveCard(card, fixtureUser, fixtureGroups, fixtureFields);
}

/** `fieldIds` is `readonly` so the `as const` fixtures compile — copy, never cast. */
function withFieldIds(card: ContactCard, fieldIds: readonly string[]): ContactCard {
  return { ...card, fieldIds: [...fieldIds] };
}

/**
 * A hand-built `ResolvedCard`, for the rows `resolveCard` would never hand over — the
 * writer has to be correct on its own, not merely correct downstream of a clean resolver.
 */
function resolvedWith(
  fields: readonly ResolvedField[],
  socialFields: readonly ResolvedField[] = [],
): ResolvedCard {
  const base = resolve(cardLedgerDemo);
  return {
    ...base,
    fields: [...fields],
    socialFields: [...socialFields],
    fieldCount: fields.length + socialFields.length,
  };
}

function field(overrides: Partial<ResolvedField> & Pick<ResolvedField, "type">): ResolvedField {
  return {
    id: `field_${overrides.type.toLowerCase()}`,
    category: "WORK",
    label: "Label",
    value: "value",
    isSensitive: false,
    ...overrides,
  };
}

const octets = (value: string): number => new TextEncoder().encode(value).length;

/** Physical lines, fold markers and all. */
const physicalLines = (vcf: string): string[] => vcf.split(CRLF);

/** RFC 2426 unfolding: a CRLF followed by one whitespace character is not a line break. */
const logicalLines = (vcf: string): string[] =>
  vcf
    .replace(/\r\n[ \t]/g, "")
    .split(CRLF)
    .filter((line) => line.length > 0);

/** The reader's half of RFC 2426 §2: unfold, then unescape. Order matters both ways. */
const unescapeValue = (value: string): string =>
  value.replace(/\\([\\;,nN])/g, (_match, char: string) =>
    char === "n" || char === "N" ? "\n" : char,
  );

/**
 * Property signature → the `FieldType` that produced it, transcribed independently of the
 * writer so AC-22's set equality is a round trip and not a tautology. `TEL` is disambiguated
 * by its `TYPE` parameter, which is why each phone-ish type carries a distinct one.
 */
const TYPE_FOR_PROPERTY: Readonly<Record<string, FieldType>> = {
  TITLE: "JOB_TITLE",
  ORG: "COMPANY",
  "X-CB-DEPARTMENT": "DEPARTMENT",
  "TEL;TYPE=CELL": "PHONE",
  "TEL;TYPE=VOICE": "LANDLINE",
  "TEL;TYPE=FAX": "FAX",
  EMAIL: "EMAIL",
  ADR: "ADDRESS",
  URL: "URL",
  "X-SOCIALPROFILE": "SOCIAL_LINK",
  "X-CB-DATE": "DATE",
  "X-CB-REG-NUMBER": "REG_NUMBER",
  "X-CB-RELATION": "RELATION",
  "X-CB-STATUS": "STATUS",
  "X-CB-LOCATION": "LOCATION_TRACKING",
  "X-CB-BANK-ACCOUNT": "BANK_ACCOUNT",
  "X-CB-DIGITAL-WALLET": "DIGITAL_WALLET",
  "X-CB-CRYPTO-WALLET": "CRYPTO_WALLET",
  "X-CB-CUSTOM": "CUSTOM",
  NOTE: "TEXT",
};

const STRUCTURAL = new Set(["BEGIN", "VERSION", "N", "FN", "END"]);

/** The `FieldType`s a `.vcf` claims to carry, read back out of the emitted text. */
function fieldTypesIn(vcf: string, resolved: ResolvedCard): Set<FieldType> {
  const footer = `NOTE:${VCARD_NOTE_PREFIX}${resolved.qrPayload}`;
  const found = new Set<FieldType>();

  for (const line of logicalLines(vcf)) {
    if (line === footer) continue; // provenance, not a field

    const name = line.slice(0, line.indexOf(":"));
    const bare = name.split(";")[0];
    if (STRUCTURAL.has(bare)) continue;

    // `EMAIL;TYPE=INTERNET` and `ADR;TYPE=INTL` key on the bare name; `TEL` needs its param.
    const mapped = TYPE_FOR_PROPERTY[name] ?? TYPE_FOR_PROPERTY[bare];
    expect(mapped, `no FieldType is mapped to the vCard property "${name}"`).toBeDefined();
    found.add(mapped);
  }

  return found;
}

/* ── the worked example (§6.7) ──────────────────────────────────────────────────────── */

describe("buildVcf — the §6.7 worked output, byte for byte", () => {
  const resolved = resolve(cardLedgerDemo);

  /**
   * Transcribed from spec §6.7 with one substitution: the spec prints the NOTE origin as
   * `https://localhost:3000`, which contradicts §8A.6's normative default of
   * `http://localhost:3000` (also AC-08's basis). The origin is not re-derived here — it is
   * `resolved.qrPayload`, which is computed once in `resolveCard` (§8A.6).
   */
  const EXPECTED =
    [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Raghunathan;Priyanka;;;",
      "FN:Priyanka Raghunathan",
      "TITLE:Head of Partnerships",
      "ORG:Fernwood Studio",
      "TEL;TYPE=CELL:+919820115577",
      "EMAIL;TYPE=INTERNET:priyanka@fernwood.example",
      "URL:https://fernwood.example",
      `NOTE:${VCARD_NOTE_PREFIX}${resolved.qrPayload}`,
      "END:VCARD",
    ].join(CRLF) + CRLF;

  it("matches the spec output exactly, CRLF and all", () => {
    expect(buildVcf(resolved)).toBe(EXPECTED);
  });

  it("is vCard 3.0: BEGIN, VERSION, then N and FN, closed by END", () => {
    const lines = logicalLines(buildVcf(resolved));

    expect(lines[0]).toBe("BEGIN:VCARD");
    expect(lines[1]).toBe("VERSION:3.0");
    expect(lines.at(-1)).toBe("END:VCARD");
  });

  it("uses CRLF everywhere and nowhere a bare LF", () => {
    const vcf = buildVcf(resolved);

    expect(vcf.replace(/\r\n/g, "")).not.toContain("\n");
    expect(vcf.endsWith(`END:VCARD${CRLF}`)).toBe(true);
  });

  it("emits properties in vCard order, not in field order", () => {
    // resolveCard sorts by FieldCategory/FieldType, which puts PHONE before JOB_TITLE; the
    // file puts TITLE first. §6.7's example is the pin for this and it is deliberate.
    expect(resolved.fields.map((entry) => entry.type)).toEqual([
      "PHONE",
      "EMAIL",
      "URL",
      "JOB_TITLE",
      "COMPANY",
    ]);
    expect(logicalLines(buildVcf(resolved))[4]).toBe("TITLE:Head of Partnerships");
  });

  it("carries the raw URL, not the 34-character display clamp of §6.6", () => {
    const withLongUrl = resolve(withFieldIds(cardLedgerDemo, ["field_press_url"]));

    expect(logicalLines(buildVcf(withLongUrl))).toContain(
      "URL:https://fernwood.example/press/2026-partnerships-overview",
    );
  });
});

/* ── the empty card: the 73-byte regression (§6.7, §11 E-01/E-02, AC-36) ────────────── */

describe("buildVcf — a zero-field card cannot produce a name-only file", () => {
  it("throws EmptyCardError for card_empty_demo instead of returning a stub", () => {
    const resolved = resolve(cardEmptyDemo);

    expect(resolved.fieldCount).toBe(0);
    expect(() => buildVcf(resolved)).toThrow(EmptyCardError);
  });

  it("names the card in the error, so a caught throw is diagnosable", () => {
    try {
      buildVcf(resolve(cardEmptyDemo));
      expect.unreachable("buildVcf must throw for a zero-field card");
    } catch (error) {
      expect(error).toBeInstanceOf(EmptyCardError);
      expect((error as EmptyCardError).cardId).toBe("card_empty_demo");
      expect((error as EmptyCardError).slug).toBe("prya-blank");
    }
  });

  it("the 73-byte regression — no input path produces an FN/N-only vCard", () => {
    // Every shape that reduced to "a card with no mappings" in the old build.
    const nameOnly: readonly ContactCard[] = [
      cardEmptyDemo,
      withFieldIds(cardLedgerDemo, []),
      withFieldIds(cardLedgerDemo, ["field_gone_a", "field_gone_b"]), // all dangling
      withFieldIds(cardLedgerDemo, ["field_draft_note"]), // mapped, but blank
      withFieldIds(cardLedgerDemo, ["field_photo"]), // mapped, but consumed by the avatar
    ];

    for (const card of nameOnly) {
      const resolved = resolve(card);
      expect(canBuildVcf(resolved)).toBe(false);
      expect(() => buildVcf(resolved)).toThrow(EmptyCardError);
    }
  });

  it("every file this writer CAN produce carries at least one contact property", () => {
    // The name-independent statement of the 73-byte bug: the failure was not "73 bytes", it
    // was "a document whose only content lines are structural". No input may reach that.
    const everyShape: readonly ContactCard[] = [
      ...fixtureCards,
      withFieldIds(cardLedgerDemo, []),
      withFieldIds(cardLedgerDemo, ["field_draft_note"]),
      withFieldIds(cardLedgerDemo, ["field_photo"]),
      withFieldIds(cardLedgerDemo, ["field_nowhere"]),
    ];

    let produced = 0;
    for (const card of everyShape) {
      const resolved = resolve(card);
      if (!canBuildVcf(resolved)) {
        expect(() => buildVcf(resolved)).toThrow(EmptyCardError);
        continue;
      }

      const content = logicalLines(buildVcf(resolved)).filter(
        (line) => !STRUCTURAL.has(line.slice(0, line.indexOf(":")).split(";")[0]),
      );
      expect(content.length, `${card.id} produced a name-only vCard`).toBeGreaterThan(0);
      produced += 1;
    }

    expect(produced).toBeGreaterThan(0); // the sweep must actually write some files
  });

  it("`canBuildVcf` is the guard the UI reads, and it agrees with the throw exactly", () => {
    for (const card of [...fixtureCards, withFieldIds(cardLedgerDemo, [])]) {
      const resolved = resolve(card);
      const guard = canBuildVcf(resolved);

      expect(guard).toBe(resolved.fieldCount > 0);
      if (guard) {
        expect(() => buildVcf(resolved)).not.toThrow();
      } else {
        expect(() => buildVcf(resolved)).toThrow(EmptyCardError);
      }
    }
  });

  it("still writes a card whose only mapped fields are social links", () => {
    // "Shares nothing" means nothing, not "no telephone". A links-only card is a real card.
    const resolved = resolve(withFieldIds(cardLedgerDemo, ["field_github", "field_x"]));

    expect(resolved.fields).toEqual([]);
    expect(resolved.fieldCount).toBe(2);
    expect(canBuildVcf(resolved)).toBe(true);
    expect(logicalLines(buildVcf(resolved))).toContain(
      "X-SOCIALPROFILE;TYPE=GitHub:https://github.com/prya",
    );
  });
});

/* ── the degenerate table (§6.7) ────────────────────────────────────────────────────── */

describe("buildVcf — blank values are omitted, never emitted empty (§11 E-07)", () => {
  it("omits the property entirely rather than writing `TEL;TYPE=CELL:`", () => {
    const vcf = buildVcf(
      resolvedWith([
        field({ type: "PHONE", id: "field_blank_phone", value: "" }),
        field({ type: "EMAIL", id: "field_email", value: "someone@example.com" }),
      ]),
    );

    expect(vcf).not.toContain("TEL");
    expect(vcf).not.toMatch(/:\r\n/);
    expect(logicalLines(vcf)).toContain("EMAIL;TYPE=INTERNET:someone@example.com");
  });

  it("treats an all-whitespace value the same way", () => {
    const vcf = buildVcf(
      resolvedWith([
        field({ type: "STATUS", id: "field_blank_status", value: "   " }),
        field({ type: "EMAIL", id: "field_email", value: "someone@example.com" }),
      ]),
    );

    expect(vcf).not.toContain("X-CB-STATUS");
  });

  it("never emits PHOTO — the avatar slot consumes it (§6.6)", () => {
    const vcf = buildVcf(
      resolvedWith([
        field({ type: "PHOTO", id: "field_photo", value: "/portraits/priyanka.png" }),
        field({ type: "EMAIL", id: "field_email", value: "someone@example.com" }),
      ]),
    );

    expect(vcf).not.toContain("PHOTO");
    expect(vcf).not.toContain("/portraits/");
  });
});

describe("buildVcf — RFC 2426 escaping (§6.7, §11 E-52)", () => {
  it("escapes `,` `;` and `\\` in a value", () => {
    const vcf = buildVcf(
      resolvedWith([field({ type: "TEXT", id: "field_punct", value: PUNCTUATED_VALUE })]),
    );

    expect(logicalLines(vcf)).toContain(
      "NOTE:Suite 4\\, Level 2\\; Anand Complex \\\\ Andheri East",
    );
  });

  it("escapes the backslash first, so `\\,` cannot be produced from `,`", () => {
    const vcf = buildVcf(
      resolvedWith([field({ type: "TEXT", id: "field_slash", value: "a\\b,c" })]),
    );

    expect(logicalLines(vcf)).toContain("NOTE:a\\\\b\\,c");
  });

  it("escapes a newline to a literal `\\n` rather than breaking the line", () => {
    const vcf = buildVcf(
      resolvedWith([field({ type: "TEXT", id: "field_multi", value: "Line one\nLine two" })]),
    );

    expect(logicalLines(vcf)).toContain("NOTE:Line one\\nLine two");
    expect(physicalLines(vcf)).not.toContain("Line two");
  });

  it("escapes the structural components of N as well", () => {
    const base = resolve(cardLedgerDemo);
    const vcf = buildVcf({ ...base, fullName: "Smith; Jr, Anna" });

    expect(logicalLines(vcf)).toContain("N:Anna;Smith\\; Jr\\,;;;");
  });

  it("passes a script-shaped value through as ordinary text (§11 E-51)", () => {
    const vcf = buildVcf(
      resolvedWith([field({ type: "TEXT", id: "field_script", value: XSS_VALUE })]),
    );

    expect(logicalLines(vcf)).toContain(`NOTE:${XSS_VALUE}`);
  });
});

describe("buildVcf — line folding at 75 OCTETS (§6.7, §11 E-16)", () => {
  it("folds a long NOTE with CRLF plus a single space", () => {
    const vcf = buildVcf(
      resolvedWith([field({ type: "TEXT", id: "field_long_note", value: LONG_NOTE })]),
    );

    expect(LONG_NOTE.length).toBeGreaterThan(200);
    expect(vcf).toContain(`${CRLF} `);

    for (const line of physicalLines(vcf)) {
      expect(octets(line)).toBeLessThanOrEqual(MAX_LINE_OCTETS);
    }
  });

  it("unfolds and unescapes back to exactly one logical NOTE line", () => {
    const vcf = buildVcf(
      resolvedWith([field({ type: "TEXT", id: "field_long_note", value: LONG_NOTE })]),
    );
    const notes = logicalLines(vcf).filter((line) => line.startsWith("NOTE:"));

    expect(notes).toHaveLength(2); // the long note, then the provenance footer
    // A reader unfolds first and unescapes second — the note survives both, unchanged.
    expect(unescapeValue(notes[0].slice("NOTE:".length))).toBe(LONG_NOTE);
  });

  it("counts octets, not characters — a multi-byte value folds sooner", () => {
    // 60 characters, 180 octets: a character-counting folder would not fold this at all.
    const cjk = "東京都渋谷区神宮前".repeat(7).slice(0, 60);
    const vcf = buildVcf(resolvedWith([field({ type: "TEXT", id: "field_cjk", value: cjk })]));

    expect(cjk).toHaveLength(60);
    expect(octets(cjk)).toBe(180);
    expect(vcf).toContain(`${CRLF} `);

    for (const line of physicalLines(vcf)) {
      expect(octets(line)).toBeLessThanOrEqual(MAX_LINE_OCTETS);
    }
    expect(logicalLines(vcf)).toContain(`NOTE:${cjk}`);
  });

  it("never splits a multi-byte character across a fold", () => {
    const mixed = `${"a".repeat(70)}—${"b".repeat(70)}—${"c".repeat(70)}`;
    const vcf = buildVcf(resolvedWith([field({ type: "TEXT", id: "field_mixed", value: mixed })]));

    // A folder that cut on a byte boundary would leave a U+FFFD here on the round trip.
    expect(logicalLines(vcf)).toContain(`NOTE:${mixed}`);
    expect(vcf).not.toContain("�");
  });

  it("leaves a line at exactly the limit unfolded", () => {
    const exact = "x".repeat(MAX_LINE_OCTETS - "NOTE:".length);
    const vcf = buildVcf(resolvedWith([field({ type: "TEXT", id: "field_exact", value: exact })]));

    expect(physicalLines(vcf)).toContain(`NOTE:${exact}`);
  });
});

/* ── masking (§6.7, §7.3, AC-33) ────────────────────────────────────────────────────── */

describe("buildVcf — masking matches what the card displays (§6.7, §7.3)", () => {
  const payments = fixtureCards.find((card) => card.id === "card_cobalt_demo");

  it("masks all three financial types to a fixed run plus the last four", () => {
    expect(payments).toBeDefined();
    const vcf = buildVcf(resolve(payments as ContactCard));
    const lines = logicalLines(vcf);

    expect(lines).toContain("X-CB-BANK-ACCOUNT:••••5678");
    expect(lines).toContain("X-CB-DIGITAL-WALLET:••••bank");
    expect(lines).toContain("X-CB-CRYPTO-WALLET:••••d612");
  });

  it("never leaks an unmasked financial value anywhere in the file", () => {
    const vcf = buildVcf(resolve(payments as ContactCard));

    expect(vcf).not.toContain("50100412345678");
    expect(vcf).not.toContain("priyanka@okhdfcbank");
    expect(vcf).not.toContain("0x8f2A55949038A501f5B7C0e1B4d8b9C3A2e4d612");
  });

  it("masks an isSensitive field too, so the payload never exceeds the display (AC-33)", () => {
    const vcf = buildVcf(resolve(withFieldIds(cardLedgerDemo, ["field_relation"])));

    expect(vcf).not.toContain("Anand Raghunathan");
    expect(logicalLines(vcf)).toContain("X-CB-RELATION:••••ther");
  });

  it("leaves a non-sensitive, non-financial value untouched", () => {
    const vcf = buildVcf(resolve(withFieldIds(cardLedgerDemo, ["field_status"])));

    expect(logicalLines(vcf)).toContain(
      "X-CB-STATUS:Taking partnership intros this quarter",
    );
  });

  it("masks a sensitive address into the street component, keeping seven of them", () => {
    const vcf = buildVcf(resolve(withFieldIds(cardLedgerDemo, ["field_home_address"])));
    const adr = logicalLines(vcf).find((line) => line.startsWith("ADR"));

    expect(adr).toBeDefined();
    expect(adr).not.toContain("Sunder Nagar");
    expect((adr as string).slice("ADR;TYPE=INTL:".length).split(";")).toHaveLength(7);
  });
});

/* ── structured values ─────────────────────────────────────────────────────────────── */

describe("buildVcf — ADR carries seven components (§6.7)", () => {
  it("maps AddressDetail onto po-box / extended / street / city / region / code / country", () => {
    const vcf = buildVcf(resolve(withFieldIds(cardLedgerDemo, ["field_work_address"])));
    const adr = logicalLines(vcf).find((line) => line.startsWith("ADR")) as string;

    expect(adr).toBe(
      "ADR;TYPE=INTL:;Raheja Titanium\\, Goregaon East;Fernwood Studio\\, 4th Floor;Mumbai;Maharashtra;400063;India",
    );
    expect(adr.slice("ADR;TYPE=INTL:".length).split(";")).toHaveLength(7);
  });

  it("falls back to the flat value in the street slot when there is no detail", () => {
    const vcf = buildVcf(
      resolvedWith([
        field({ type: "ADDRESS", id: "field_flat_adr", value: "12 Queen Street, Bath" }),
      ]),
    );

    expect(logicalLines(vcf)).toContain("ADR;TYPE=INTL:;;12 Queen Street\\, Bath;;;;");
  });

  it("normalises telephone numbers to E.164 and lowercases emails", () => {
    const vcf = buildVcf(
      resolvedWith([
        field({ type: "PHONE", id: "field_p", value: "+91 98201-15577" }),
        field({ type: "LANDLINE", id: "field_l", value: "+91 22 6123 4567" }),
        field({ type: "FAX", id: "field_f", value: "+912243005599" }),
        field({ type: "EMAIL", id: "field_e", value: "  Priyanka@Fernwood.EXAMPLE " }),
      ]),
    );
    const lines = logicalLines(vcf);

    expect(lines).toContain("TEL;TYPE=CELL:+919820115577");
    expect(lines).toContain("TEL;TYPE=VOICE:+912261234567");
    expect(lines).toContain("TEL;TYPE=FAX:+912243005599");
    expect(lines).toContain("EMAIL;TYPE=INTERNET:priyanka@fernwood.example");
  });

  it("labels a social link with the platform read from its hostname", () => {
    const vcf = buildVcf(resolve(withFieldIds(cardLedgerDemo, ["field_linkedin"])));

    expect(logicalLines(vcf)).toContain(
      "X-SOCIALPROFILE;TYPE=LinkedIn:https://www.linkedin.com/in/priyankaraghunathan",
    );
  });

  it("falls back to the hostname for an unrecognised platform (§11 E-23)", () => {
    const vcf = buildVcf(
      resolveCard(
        withFieldIds(cardLedgerDemo, ["field_mastodon"]),
        fixtureUser,
        extremeGroups,
        extremeFields,
      ),
    );

    expect(logicalLines(vcf)).toContain("X-SOCIALPROFILE;TYPE=mastodon.example:https://mastodon.example/@prya");
  });

  it("never writes a coordinate for LOCATION_TRACKING (§7.3)", () => {
    const status = buildVcf(resolve(withFieldIds(cardLedgerDemo, ["field_location"])));
    expect(logicalLines(status)).toContain("X-CB-LOCATION:Sharing with saved contacts");

    const coordinates = buildVcf(
      resolvedWith([
        field({ type: "LOCATION_TRACKING", id: "field_coords", value: "19.0760, 72.8777" }),
        field({ type: "EMAIL", id: "field_e", value: "someone@example.com" }),
      ]),
    );
    expect(coordinates).not.toContain("X-CB-LOCATION");
    expect(coordinates).not.toContain("19.0760");
  });
});

/* ── AC-22: the set of field types in the file equals the set on the card ───────────── */

describe("AC-22 — the .vcf carries exactly the field types the card renders", () => {
  const writable = fixtureCards.filter((card) => resolve(card).fieldCount > 0);

  it("sweeps every writable fixture card, and the sweep is real", () => {
    expect(writable.length).toBe(fixtureCards.length - 1); // all but card_empty_demo
  });

  it.each(writable.map((card) => [card.id, card] as const))(
    "%s — the emitted properties map back to exactly the rendered field types",
    (_id, card) => {
      const resolved = resolve(card);
      const rendered = new Set<FieldType>(
        [...resolved.fields, ...resolved.socialFields].map((entry) => entry.type),
      );

      expect(fieldTypesIn(buildVcf(resolved), resolved)).toEqual(rendered);
    },
  );

  it("covers every FieldType that can appear on a card at least once across the sweep", () => {
    const covered = new Set<FieldType>();
    for (const card of writable) {
      const resolved = resolve(card);
      for (const entry of [...resolved.fields, ...resolved.socialFields]) covered.add(entry.type);
    }

    // If this ever drops, the sweep above has stopped exercising a mapping row.
    expect(covered.size).toBeGreaterThanOrEqual(16);
  });
});

/* ── the download, and purity ──────────────────────────────────────────────────────── */

describe("buildVcf — the download contract (§6.9)", () => {
  it("declares the vCard media type with its charset", () => {
    expect(VCARD_MIME_TYPE).toBe("text/vcard;charset=utf-8");
  });

  it("names the file after the person, per §6.9's `download` attribute", () => {
    expect(vcfFileName(resolve(cardLedgerDemo))).toBe("Priyanka Raghunathan.vcf");
  });

  it("never produces a filename with a path separator in it", () => {
    const base = resolve(cardLedgerDemo);
    const name = vcfFileName({ ...base, fullName: "Anna / Ben: Smith" });

    expect(name.endsWith(".vcf")).toBe(true);
    expect(name).not.toMatch(/[\\/:*?"<>|]/);
  });

  it("falls back to the slug when there is no name to use", () => {
    const base = resolve(cardLedgerDemo);
    expect(vcfFileName({ ...base, fullName: "   " })).toBe("prya-hq.vcf");
  });
});

describe("buildVcf — purity", () => {
  it("does not mutate the ResolvedCard it is given", () => {
    const resolved = resolve(cardLedgerDemo);
    const before = JSON.stringify(resolved);

    buildVcf(resolved);

    expect(JSON.stringify(resolved)).toBe(before);
  });

  it("returns the same string for the same object, twice", () => {
    const resolved = resolve(cardLedgerDemo);
    expect(buildVcf(resolved)).toBe(buildVcf(resolved));
  });

  it("reads only the object it is handed — nothing is re-derived from the card", () => {
    const resolved = resolve(cardLedgerDemo);
    const edited = { ...resolved, fullName: "Someone Else" };

    expect(buildVcf(edited)).toContain("FN:Someone Else");
    expect(buildVcf(edited)).not.toContain("FN:Priyanka Raghunathan");
  });

  it("writes a mononym into the family component rather than dropping it", () => {
    const base = resolve(cardLedgerDemo);
    expect(logicalLines(buildVcf({ ...base, fullName: "Cher" }))).toContain("N:Cher;;;;");
  });

  it("falls back to the card name when the user has no name at all", () => {
    const base = resolve(cardLedgerDemo);
    const lines = logicalLines(buildVcf({ ...base, fullName: "" }));

    expect(lines).toContain("FN:Work");
  });
});
