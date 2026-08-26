import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "../helpers/render";
import {
  ALWAYS_MASKED_TYPES,
  FIELD_ICON_SIZES,
  FIELD_RENDERERS,
  FIELD_VALUE_CLASS,
  LOCATION_STATUS_FALLBACK,
  isInlineEditable,
  isMaskedField,
  renderFieldRow,
  renderFieldRows,
  type FieldRow,
} from "@/card/field-renderers";
import { MASK_RUN, URL_DISPLAY_MAX } from "@/lib/format";
import { hostileFields, UNBROKEN_TOKEN, XSS_VALUE } from "@/fixtures/extremes";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import type {
  FieldCategory,
  FieldType,
  ProfileField,
  ResolvedField,
} from "@/types/domain";

/**
 * The field renderer contract — spec §6.6 (the mapping table, row by row), §7.3 (masking
 * is a security rule, not a display preference), §8.8 (icon discipline) and AC-21 / AC-33.
 *
 * AC-21's *primary* proof is `tsc`: `FIELD_RENDERERS` is typed `Record<FieldType, …>`, so
 * a missing member is TS2741 and the build stops. This file proves the other half — that
 * all 21 entries actually behave like the §6.6 table says, because a registry that is
 * complete and wrong compiles perfectly.
 *
 * ⚠ happy-dom has no layout engine: nothing here asserts geometry (spec §14.6). Clamping
 * that is CSS (`line-clamp`, `overflow-wrap`) is asserted as a *class contract*; the pixels
 * are T27/T28/T31's job in a real browser.
 */

/** §5.1, transcribed. The count is the assertion — 21, no more and no fewer. */
const FIELD_TYPES: readonly FieldType[] = [
  "PHONE",
  "LANDLINE",
  "FAX",
  "EMAIL",
  "ADDRESS",
  "URL",
  "SOCIAL_LINK",
  "PHOTO",
  "TEXT",
  "DATE",
  "JOB_TITLE",
  "COMPANY",
  "REG_NUMBER",
  "DEPARTMENT",
  "RELATION",
  "STATUS",
  "LOCATION_TRACKING",
  "BANK_ACCOUNT",
  "DIGITAL_WALLET",
  "CRYPTO_WALLET",
  "CUSTOM",
];

/** §6.6's "verbatim, clamped" row — one group of eight types with identical behaviour. */
const VERBATIM_TYPES: readonly FieldType[] = [
  "JOB_TITLE",
  "COMPANY",
  "DEPARTMENT",
  "TEXT",
  "RELATION",
  "STATUS",
  "REG_NUMBER",
  "CUSTOM",
];

const SOURCE_PATH = join(process.cwd(), "src/card/field-renderers.tsx");

type FieldSeed = Pick<ResolvedField, "type" | "value"> & Partial<ResolvedField>;

function resolved(seed: FieldSeed): ResolvedField {
  return {
    id: seed.id ?? `field_${seed.type.toLowerCase()}`,
    type: seed.type,
    category: seed.category ?? "CUSTOM",
    label: seed.label ?? "Label",
    value: seed.value,
    isSensitive: seed.isSensitive ?? false,
    detail: seed.detail,
  };
}

/** Carry a fixture `ProfileField` into the shape a renderer receives (§6.4). */
function fromProfile(field: ProfileField): ResolvedField {
  const group = fixtureGroups.find((candidate) => candidate.id === field.groupId);
  const category: FieldCategory = group?.category ?? "CUSTOM";
  return {
    id: field.id,
    type: field.type,
    category,
    label: field.label,
    value: field.value,
    isSensitive: field.isSensitive,
    detail: field.detail,
  };
}

/**
 * The first *non-sensitive* fixture field of a type, so an unmasked assertion is not
 * accidentally handed `field_home_address` and left arguing with AC-33. Falls back to a
 * sensitive one when that is all the profile has (the three financial types).
 */
function fixtureOfType(type: FieldType): ResolvedField {
  const candidates = fixtureFields.filter(
    (field) => field.type === type && field.value.trim().length > 0,
  );
  const match = candidates.find((field) => !field.isSensitive) ?? candidates[0];
  if (match === undefined) throw new Error(`no fixture field of type ${type}`);
  return fromProfile(match);
}

function profileFieldById(id: string): ProfileField {
  const match = [...fixtureFields, ...hostileFields].find((field) => field.id === id);
  if (match === undefined) throw new Error(`no fixture field with id ${id}`);
  return match;
}

function requireRow(field: ResolvedField) {
  const row = renderFieldRow(field);
  if (row === null) throw new Error(`expected a row for ${field.type}`);
  return row;
}

/** Render a row's icon on its own so its ARIA and size can be read off the DOM. */
function renderIcon(icon: ReactNode): SVGElement {
  const { container } = renderWithProviders(<span>{icon}</span>);
  const svg = container.querySelector("svg");
  if (svg === null) throw new Error("renderer produced no icon element");
  return svg;
}

describe("FIELD_RENDERERS exhaustiveness (AC-21, spec §6.6)", () => {
  it("has an entry for all 21 FieldType members", () => {
    expect(Object.keys(FIELD_RENDERERS)).toHaveLength(21);
    expect(Object.keys(FIELD_RENDERERS).sort()).toEqual([...FIELD_TYPES].sort());
  });

  it("exposes every entry as a callable renderer", () => {
    for (const type of FIELD_TYPES) {
      expect(typeof FIELD_RENDERERS[type], type).toBe("function");
    }
  });

  it("renders every field type present in the fixture profile without throwing", () => {
    const covered = new Set(fixtureFields.map((field) => field.type));
    expect(covered.size).toBe(21);

    for (const field of fixtureFields) {
      expect(() => renderFieldRow(fromProfile(field)), field.id).not.toThrow();
    }
  });

  it("dispatches through the registry rather than a default fallback", () => {
    const withoutIcon = (row: FieldRow) => ({ ...row, icon: null });

    for (const type of FIELD_TYPES) {
      const field = resolved({ type, value: "sample value" });
      const direct = FIELD_RENDERERS[type](field);
      const dispatched = renderFieldRow(field);

      expect(dispatched === null, type).toBe(direct === null);
      if (direct !== null && dispatched !== null) {
        expect(withoutIcon(dispatched), type).toEqual(withoutIcon(direct));
      }
    }
  });
});

describe("§6.6 — PHONE, LANDLINE, FAX", () => {
  it("formats E.164 for display and links with tel:", () => {
    const row = requireRow(fixtureOfType("PHONE"));
    expect(row.display).toBe("+91 98330 04411");
    expect(row.href).toBe("tel:+919833004411");
    expect(row.external).toBe(false);
    expect(row.variant).toBe("link");
  });

  it("links LANDLINE and FAX with tel: as well", () => {
    for (const type of ["LANDLINE", "FAX"] as const) {
      const row = requireRow(resolved({ type, value: "+912243005500" }));
      expect(row.href, type).toBe("tel:+912243005500");
    }
  });

  it("leaves a number from an unmodelled dialling plan ungrouped", () => {
    const row = requireRow(resolved({ type: "PHONE", value: "+27115550100" }));
    expect(row.display).toBe("+27115550100");
  });
});

describe("§6.6 — EMAIL", () => {
  it("lowercases the address and links with mailto:", () => {
    const row = requireRow(resolved({ type: "EMAIL", value: "  Priyanka@Fernwood.EXAMPLE " }));
    expect(row.display).toBe("priyanka@fernwood.example");
    expect(row.href).toBe("mailto:priyanka@fernwood.example");
    expect(row.external).toBe(false);
  });
});

describe("§6.6 — URL", () => {
  it("strips the protocol and clamps the display to 34 characters", () => {
    const row = requireRow(resolved({ type: "URL", value: UNBROKEN_TOKEN }));
    expect(row.display).not.toContain("https://");
    expect(row.display.length).toBeLessThanOrEqual(URL_DISPLAY_MAX);
    expect(row.external).toBe(true);
  });

  it("keeps the raw URL as the href and the full URL as the title", () => {
    const row = requireRow(resolved({ type: "URL", value: "https://fernwood.example" }));
    expect(row.href).toBe("https://fernwood.example");
    expect(row.title).toBe("https://fernwood.example");
  });

  it("absolutises a protocol-less value so the href is never a same-origin path", () => {
    const row = requireRow(resolved({ type: "URL", value: "fernwood.example/press" }));
    expect(row.href).toBe("https://fernwood.example/press");
  });

  it("refuses a non-http scheme rather than emitting it as an href (AC-32, §7.4)", () => {
    for (const value of ["javascript:alert(1)", "data:text/html,<script>x</script>"]) {
      const row = requireRow(resolved({ type: "URL", value }));
      expect(row.href, value).toBeNull();
      expect(row.display.length, value).toBeGreaterThan(0);
    }
  });
});

describe("§6.6 — SOCIAL_LINK", () => {
  it("derives the platform from the hostname and shows @handle when parseable", () => {
    const row = requireRow(
      resolved({ type: "SOCIAL_LINK", value: "https://www.linkedin.com/in/priyankaraghunathan" }),
    );
    expect(row.context).toBe("LinkedIn");
    expect(row.display).toBe("@priyankaraghunathan");
    expect(row.href).toBe("https://www.linkedin.com/in/priyankaraghunathan");
    expect(row.external).toBe(true);
  });

  it("falls back to the bare hostname for an unrecognised host (E-23)", () => {
    const row = requireRow(resolved({ type: "SOCIAL_LINK", value: "https://mastodon.example/@prya" }));
    expect(row.context).toBe("mastodon.example");
    expect(row.display.length).toBeGreaterThan(0);
    expect(renderIcon(row.icon)).not.toBeNull();
  });

  it("never crashes and never leaves an empty slot on an unparseable value (E-23)", () => {
    const row = requireRow(resolved({ type: "SOCIAL_LINK", value: "not a url at all" }));
    expect(row.display).toBe("not a url at all");
    expect(row.href).toBeNull();
    expect(renderIcon(row.icon)).not.toBeNull();
  });
});

describe("§6.6 — ADDRESS", () => {
  it("composes AddressDetail to 1–2 lines with a maps deep link", () => {
    const row = requireRow(fixtureOfType("ADDRESS"));
    expect(row.lines.length).toBeGreaterThanOrEqual(1);
    expect(row.lines.length).toBeLessThanOrEqual(2);
    expect(row.variant).toBe("address");
    expect(row.href).toContain("google.com/maps");
    expect(row.external).toBe(true);
  });

  it("degrades to the raw value with no link when the detail is missing", () => {
    const row = requireRow(resolved({ type: "ADDRESS", value: "12 Nowhere Lane" }));
    expect(row.lines).toEqual(["12 Nowhere Lane"]);
    expect(row.href).toBeNull();
  });
});

describe("§6.6 — PHOTO", () => {
  it("never renders a field row — the avatar slot consumes it", () => {
    const field = fixtureOfType("PHOTO");
    expect(FIELD_RENDERERS.PHOTO(field)).toBeNull();
    expect(renderFieldRow(field)).toBeNull();
  });

  it("is filtered out of a batch render, not emitted blank", () => {
    const rows = renderFieldRows([
      fixtureOfType("PHOTO"),
      resolved({ type: "TEXT", value: "kept" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].display).toBe("kept");
  });
});

describe("§6.6 — DATE", () => {
  it("formats en-GB long form", () => {
    const row = requireRow(resolved({ type: "DATE", value: "1991-03-08" }));
    expect(row.display).toBe("8 March 1991");
    expect(row.href).toBeNull();
  });
});

describe("§6.6 — the verbatim group", () => {
  it("shows the stored value unchanged with no href", () => {
    for (const type of VERBATIM_TYPES) {
      const row = requireRow(resolved({ type, value: "Head of Partnerships" }));
      expect(row.display, type).toBe("Head of Partnerships");
      expect(row.href, type).toBeNull();
      expect(row.variant, type).toBe("text");
    }
  });

  it("carries the untruncated value in `title` so a CSS clamp keeps the full text (E-11, E-12)", () => {
    const longTitle = profileFieldById("field_x_long_title");
    const row = requireRow(fromProfile(longTitle));
    expect(row.title.length).toBeGreaterThan(40);
    expect(row.title).toBe(longTitle.value);
  });
});

describe("§6.6 / §7.3 — LOCATION_TRACKING", () => {
  it("renders a status chip, not a link", () => {
    const row = requireRow(fixtureOfType("LOCATION_TRACKING"));
    expect(row.variant).toBe("status");
    expect(row.href).toBeNull();
    expect(row.display).toBe("Sharing with saved contacts");
  });

  it("never renders a coordinate on any surface (§7.3, AC-33)", () => {
    for (const value of ["19.0760, 72.8777", "-33.8688;151.2093", "51.5072/-0.1276"]) {
      const row = requireRow(resolved({ type: "LOCATION_TRACKING", value }));
      expect(row.display, value).toBe(LOCATION_STATUS_FALLBACK);
      expect(row.display, value).not.toMatch(/\d/);
      expect(row.title, value).toBe(LOCATION_STATUS_FALLBACK);
    }
  });
});

describe("AC-33 — masking is a security rule, not a display preference (§7.3)", () => {
  it("names exactly the three financial types as always-masked", () => {
    expect([...ALWAYS_MASKED_TYPES].sort()).toEqual([
      "BANK_ACCOUNT",
      "CRYPTO_WALLET",
      "DIGITAL_WALLET",
    ]);
  });

  it("masks BANK_ACCOUNT to •••• plus the last four, with no link", () => {
    const row = requireRow(fixtureOfType("BANK_ACCOUNT"));
    expect(row.masked).toBe(true);
    expect(row.display).toBe(`${MASK_RUN}5678`);
    expect(row.display).not.toContain("50100412");
    expect(row.href).toBeNull();
    expect(row.context).toBe("HDFC Bank");
  });

  it("masks DIGITAL_WALLET and CRYPTO_WALLET even when isSensitive is false", () => {
    const upi = requireRow(fixtureOfType("DIGITAL_WALLET"));
    expect(upi.masked).toBe(true);
    expect(upi.display).toBe(`${MASK_RUN}bank`);
    expect(upi.context).toBe("UPI");

    const crypto = requireRow(fixtureOfType("CRYPTO_WALLET"));
    expect(crypto.masked).toBe(true);
    expect(crypto.display).toBe(`${MASK_RUN}d612`);
    expect(crypto.display).not.toContain("0x8f2A");
    expect(crypto.context).toBe("Ethereum");
  });

  it("never leaks the secret through `title` or `lines`", () => {
    for (const type of ALWAYS_MASKED_TYPES) {
      const row = requireRow(fixtureOfType(type));
      expect(row.title, type).toBe(row.display);
      expect(row.lines, type).toEqual([row.display]);
    }
  });

  it("shows no tail at all when the secret is four characters or shorter", () => {
    const row = requireRow(
      resolved({
        type: "DIGITAL_WALLET",
        value: "ab12",
        detail: { kind: "DIGITAL_WALLET", provider: "PayPal", handle: "ab12" },
      }),
    );
    expect(row.display).toBe(MASK_RUN);
  });

  it("masks any isSensitive field, whatever its type (§6.6 security rule)", () => {
    for (const type of FIELD_TYPES) {
      if (type === "PHOTO") continue;
      const field = resolved({ type, value: "1234567890", isSensitive: true });
      expect(isMaskedField(field), type).toBe(true);

      const row = requireRow(field);
      expect(row.masked, type).toBe(true);
      expect(row.display, type).toContain(MASK_RUN);
      expect(row.display, type).not.toContain("123456");
      expect(row.href, type).toBeNull();
    }
  });

  it("masks a sensitive phone without leaving the full number in the href", () => {
    const row = requireRow(
      resolved({ type: "PHONE", value: "+912261234567", isSensitive: true }),
    );
    expect(row.display).toBe(`${MASK_RUN}4567`);
    expect(row.href).toBeNull();
    expect(row.external).toBe(false);
  });

  it("masks a sensitive LOCATION_TRACKING value without exposing a coordinate", () => {
    const row = requireRow(
      resolved({ type: "LOCATION_TRACKING", value: "19.0760, 72.8777", isSensitive: true }),
    );
    expect(row.display).not.toMatch(/\d/);
    expect(row.masked).toBe(true);
  });

  it("leaves a non-sensitive, non-financial field unmasked", () => {
    const row = requireRow(fixtureOfType("EMAIL"));
    expect(row.masked).toBe(false);
    expect(isMaskedField(fixtureOfType("EMAIL"))).toBe(false);
  });
});

describe("E-07 — a blank value is never a row", () => {
  it("returns null for an empty value", () => {
    for (const type of FIELD_TYPES) {
      expect(renderFieldRow(resolved({ type, value: "" })), type).toBeNull();
      expect(renderFieldRow(resolved({ type, value: "   " })), type).toBeNull();
    }
  });

  it("drops the blank fixture field out of a batch render", () => {
    expect(renderFieldRows([fromProfile(profileFieldById("field_draft_note"))])).toEqual([]);
  });
});

describe("E-15 — a 60-character unbroken token may never scroll the page", () => {
  it("publishes an overflow-wrap class for every consumer of a field value", () => {
    expect(FIELD_VALUE_CLASS).toContain("overflow-wrap:anywhere");
  });
});

describe("§8.8 — icon discipline", () => {
  it("offers exactly the three sanctioned sizes", () => {
    expect(FIELD_ICON_SIZES).toEqual([16, 20, 24]);
  });

  it("renders a decorative 16px icon by default", () => {
    const svg = renderIcon(requireRow(fixtureOfType("EMAIL")).icon);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("height")).toBe("16");
  });

  it("honours 20 and 24 and nothing else", () => {
    for (const size of FIELD_ICON_SIZES) {
      const row = FIELD_RENDERERS.EMAIL(fixtureOfType("EMAIL"), { iconSize: size });
      expect(row).not.toBeNull();
      const svg = renderIcon(row?.icon);
      expect(svg.getAttribute("width"), String(size)).toBe(String(size));
    }
  });

  it("gives every renderable field type an icon", () => {
    for (const type of FIELD_TYPES) {
      if (type === "PHOTO") continue;
      const row = requireRow(resolved({ type, value: "sample value" }));
      expect(renderIcon(row.icon), type).not.toBeNull();
    }
  });
});

describe("AC-32 / E-51 — hostile input is text, never markup", () => {
  it("contains no dangerouslySetInnerHTML", () => {
    expect(readFileSync(SOURCE_PATH, "utf8")).not.toContain("dangerouslySetInnerHTML");
  });

  it("passes a script payload through as an inert string", () => {
    const row = requireRow(resolved({ type: "TEXT", value: XSS_VALUE }));
    expect(row.display).toBe(XSS_VALUE);

    const { container } = renderWithProviders(<span>{row.display}</span>);
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toBe(XSS_VALUE);
  });

  it("marks every http(s) href as external so the consumer adds rel=noopener noreferrer", () => {
    for (const type of ["URL", "SOCIAL_LINK", "ADDRESS"] as const) {
      const row = requireRow(fixtureOfType(type));
      expect(row.href, type).not.toBeNull();
      expect(row.external, type).toBe(true);
    }
  });
});

describe("renderFieldRows", () => {
  it("preserves input order and drops only the rows that must not render", () => {
    const input: readonly ResolvedField[] = [
      resolved({ type: "JOB_TITLE", value: "Head of Partnerships" }),
      fixtureOfType("PHOTO"),
      resolved({ type: "COMPANY", value: "" }),
      resolved({ type: "COMPANY", value: "Fernwood Studio" }),
    ];
    expect(renderFieldRows(input).map((row) => row.display)).toEqual([
      "Head of Partnerships",
      "Fernwood Studio",
    ]);
  });

  it("accepts an icon size for the whole batch", () => {
    const rows = renderFieldRows([fixtureOfType("EMAIL")], { iconSize: 24 });
    expect(renderIcon(rows[0].icon).getAttribute("width")).toBe("24");
  });
});

/**
 * ⚠ **Which fields the builder may edit in place — a §7.3 boundary, not a UX preference.**
 *
 * The Fields panel puts `<input value={…}>` on every editable row. "A masked value must not
 * reach the DOM — not as text, not in an attribute" is absolute everywhere but `/profile`, and
 * `value` is precisely that attribute, so `isInlineEditable` is the thing standing between the
 * masking rule and an account number in the builder's HTML.
 *
 * Asserted over the whole `FieldType` union rather than over a sample, so adding a type is a
 * decision somebody has to make here rather than a default that lets it through.
 */
describe("isInlineEditable", () => {
  it("refuses every always-masked type, whatever the owner marked", () => {
    for (const type of ALWAYS_MASKED_TYPES) {
      expect(isInlineEditable({ type, isSensitive: false }), type).toBe(false);
    }
  });

  it("refuses anything the owner marked sensitive, of any type", () => {
    for (const type of FIELD_TYPES) {
      expect(isInlineEditable({ type, isSensitive: true }), type).toBe(false);
    }
  });

  /* `value` alone is not the whole field for these three: `ADDRESS` carries a seven-component
     detail a one-line box would flatten, `PHOTO` is not text, and `LOCATION_TRACKING` collapses
     to a status by §7.3 — an input would put the coordinate straight back in the DOM. */
  it("refuses the types whose value is not the whole truth", () => {
    for (const type of ["ADDRESS", "PHOTO", "LOCATION_TRACKING"] as const) {
      expect(isInlineEditable({ type, isSensitive: false }), type).toBe(false);
    }
  });

  it("allows the plain-string types, so the common field is editable on the card", () => {
    for (const type of ["PHONE", "EMAIL", "URL", "JOB_TITLE", "COMPANY", "CUSTOM"] as const) {
      expect(isInlineEditable({ type, isSensitive: false }), type).toBe(true);
    }
  });

  /** Every type is classified, and no editable type is also masked. The two cannot overlap. */
  it("classifies the whole union, and never contradicts isMaskedField", () => {
    for (const type of FIELD_TYPES) {
      for (const isSensitive of [true, false]) {
        const field = { type, isSensitive };
        expect(typeof isInlineEditable(field), type).toBe("boolean");
        if (isMaskedField(field)) expect(isInlineEditable(field), type).toBe(false);
      }
    }
  });
});
