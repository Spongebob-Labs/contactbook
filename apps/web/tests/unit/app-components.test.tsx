import { readdirSync, readFileSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";

import { describe, expect, it } from "vitest";

import { renderWithProviders, screen, within } from "../helpers/render";

import * as barrel from "@/components/app";
import { CardThumbTile } from "@/components/app/card-thumb-tile";
import { CARD_TYPE_LABELS, CardTypeChip } from "@/components/app/card-type-chip";
import { ContactRow } from "@/components/app/contact-row";
import {
  EMPTY_CARD_NOTE,
  FieldCountMeter,
  fieldCountLabel,
} from "@/components/app/field-count-meter";
import { FIELD_CATEGORY_LABELS, FieldList } from "@/components/app/field-list";
import { StatRow } from "@/components/app/stat-row";
import { canBuildVcf } from "@/card/build-vcf";
import { resolveCard } from "@/card/resolve-card";
import { cardEmptyDemo, cardLedgerDemo, fixtureCards } from "@/fixtures/cards";
import { fixtureContacts } from "@/fixtures/contacts";
import { LONG_NAME, extremeFields, extremeGroups, extremeUserLongName } from "@/fixtures/extremes";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import { fixtureUser } from "@/fixtures/user";
import type {
  CardType,
  Contact,
  ContactCard,
  FieldCategory,
  ResolvedCard,
  ResolvedField,
} from "@/types/domain";

/**
 * The shared `(app)` component contracts (plan T17; spec §8D.3, §6.6, §7.3, §11).
 *
 * Six wave-7 screen tracks compose these seven components, so everything asserted here is
 * something a screen depends on. Three of the assertions are the reason the track exists:
 *
 * - **AC-36** — `FieldCountMeter` reports `data-field-count` and turns into a warning at
 *   zero, gated on `canBuildVcf` and never on a second, local field count. The old build
 *   shipped a 73-byte name-only `.vcf` from a card with no mappings; a duplicated guard is
 *   how that comes back.
 * - **E-13** — a 40+ character name in a `thumb` tile clamps to one line and the tile keeps
 *   its grid cell.
 * - **The contact registry** — `ContactRow` falls back to the number when a contact has no name
 *   (routine after an import) and badges one who has opted out. E-39's dangling-slug rule went
 *   with `SourceCardLink`: a contact no longer has a source card.
 *
 * ⚠ happy-dom has no layout engine and no stylesheet: never assert geometry or computed
 * colour here (spec §14.6). What this file proves is DOM shape, ARIA and class contracts.
 * The rendered clamp and the rendered grid are Playwright's, in T31.
 */

const resolve = (card: ContactCard, user = fixtureUser): ResolvedCard =>
  resolveCard(card, user, fixtureGroups, fixtureFields);

/** Five mapped fields, a `BUSINESS` card on Ledger — the §6.7 worked example. */
const LEDGER = resolve(cardLedgerDemo);

/** Zero mapped fields, and the newest card by `updatedAt`. The whole reason for AC-36. */
const EMPTY = resolve(cardEmptyDemo);

/**
 * A links-only card. It shares something, so it is **not** empty — the case that tells
 * `canBuildVcf` (which counts `fields` *and* `socialFields`) apart from a local
 * `fields.length > 0`.
 */
const SOCIAL_ONLY = resolve({
  ...cardLedgerDemo,
  id: "card_t17_social",
  publicUrl: "https://card.example/c/1o2sidSvpWopexhIISCMdL",
  fieldIds: ["field_linkedin", "field_mastodon"],
});

/** The three §7.3 financial rows plus context, on one card. */
const PAYMENTS = resolve({
  ...cardLedgerDemo,
  id: "card_t17_payments",
  publicUrl: "https://card.example/c/0ybwvPH7cJiJ3c0seoptAq",
  type: "PAYMENT",
  fieldIds: ["field_company", "field_bank", "field_upi", "field_crypto", "field_work_phone"],
});

/** The public card's mixed bag: a URL, a social link with an unrecognised host (E-23). */
const MIXED = resolve({
  ...cardLedgerDemo,
  id: "card_t17_mixed",
  publicUrl: "https://card.example/c/3ZtRC6JO4ANWpv2ajrAuf4",
  fieldIds: ["field_job_title", "field_site_url", "field_mastodon", "field_work_email"],
});

/**
 * What a detail screen actually hands the list: `resolveCard` splits `SOCIAL_LINK` out into
 * `socialFields` for the card's social row (§6.4), and a field list shows both.
 */
const MIXED_ALL: readonly ResolvedField[] = [...MIXED.fields, ...MIXED.socialFields];

const LONG = resolveCard(
  {
    ...cardLedgerDemo,
    id: "card_t17_long",
    publicUrl: "https://card.example/c/1pJlgBjPofikhfAFY6hvDI",
    name: "Conference handouts, printed batch two, autumn",
  },
  extremeUserLongName,
  extremeGroups,
  extremeFields,
);

function fieldRowIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[data-field-row]")].map(
    (node) => node.getAttribute("data-field-row") ?? "",
  );
}

/* ══ FieldCountMeter — AC-36, the empty-card guard ═════════════════════════════════ */

describe("FieldCountMeter (AC-36, §13.2)", () => {
  it("reports the resolved field count on data-field-count", () => {
    renderWithProviders(<FieldCountMeter resolved={LEDGER} />);
    const meter = document.querySelector("[data-field-count-meter]");
    expect(meter).toHaveAttribute("data-field-count", String(LEDGER.fieldCount));
    expect(LEDGER.fieldCount).toBeGreaterThan(0);
  });

  it("renders the warning treatment at zero, in words and not by colour alone", () => {
    renderWithProviders(<FieldCountMeter resolved={EMPTY} />);
    const meter = document.querySelector("[data-field-count-meter]");

    expect(meter).toHaveAttribute("data-field-count", "0");
    expect(meter).toHaveAttribute("data-field-count-state", "empty");
    expect(meter).toHaveAttribute("data-tone", "warning");
    expect(meter).toHaveTextContent("0 fields");
    expect(meter).toHaveTextContent(EMPTY_CARD_NOTE);
  });

  it("does not warn when the card shares something", () => {
    renderWithProviders(<FieldCountMeter resolved={LEDGER} />);
    const meter = document.querySelector("[data-field-count-meter]");

    expect(meter).toHaveAttribute("data-field-count-state", "sharing");
    expect(meter).not.toHaveAttribute("data-tone", "warning");
    expect(meter).not.toHaveTextContent(EMPTY_CARD_NOTE);
  });

  it("treats a links-only card as sharing — canBuildVcf counts socials too", () => {
    expect(SOCIAL_ONLY.fields).toHaveLength(0);
    expect(SOCIAL_ONLY.socialFields.length).toBeGreaterThan(0);
    expect(canBuildVcf(SOCIAL_ONLY)).toBe(true);

    renderWithProviders(<FieldCountMeter resolved={SOCIAL_ONLY} />);
    const meter = document.querySelector("[data-field-count-meter]");

    expect(meter).toHaveAttribute("data-field-count", String(SOCIAL_ONLY.fieldCount));
    expect(meter).toHaveAttribute("data-field-count-state", "sharing");
  });

  it("carries the same contract in the builder-header variant", () => {
    const { unmount } = renderWithProviders(<FieldCountMeter resolved={EMPTY} variant="meter" />);
    let meter = document.querySelector("[data-field-count-meter]");
    expect(meter).toHaveAttribute("data-field-count", "0");
    expect(meter).toHaveAttribute("data-field-count-state", "empty");
    expect(meter).toHaveTextContent(EMPTY_CARD_NOTE);
    unmount();

    renderWithProviders(<FieldCountMeter resolved={LEDGER} variant="meter" />);
    meter = document.querySelector("[data-field-count-meter]");
    expect(meter).toHaveAttribute("data-field-count", String(LEDGER.fieldCount));
    expect(meter).toHaveAttribute("data-field-count-state", "sharing");
    expect(meter?.querySelector("[data-field-count-value]")).toHaveClass("tabular-nums");
  });

  it("labels one field in the singular", () => {
    expect(fieldCountLabel(0)).toBe("0 fields");
    expect(fieldCountLabel(1)).toBe("1 field");
    expect(fieldCountLabel(5)).toBe("5 fields");
  });

  it("agrees with canBuildVcf for every fixture card", () => {
    for (const card of fixtureCards) {
      const resolved = resolve(card);
      const { unmount } = renderWithProviders(<FieldCountMeter resolved={resolved} />);
      const meter = document.querySelector("[data-field-count-meter]");

      expect(meter, card.id).toHaveAttribute(
        "data-field-count-state",
        canBuildVcf(resolved) ? "sharing" : "empty",
      );
      unmount();
    }
  });

  it("reads the guard from @/card/build-vcf and never re-counts fields locally", () => {
    const source = readFileSync(
      resolvePath(process.cwd(), "src/components/app/field-count-meter.tsx"),
      "utf8",
    );

    // T11 proved by mutation that removing its throw regenerates the original bug. A second
    // definition of "this card shares nothing" is the same defect one directory away.
    expect(source).toMatch(/canBuildVcf/);
    expect(source).toMatch(/from "@\/card\/build-vcf"/);
    expect(source, "inline field-count comparison").not.toMatch(/fieldCount\s*[<>=!]/);
    expect(source, "inline length comparison").not.toMatch(/\.length\s*[<>]/);
  });
});

/* ══ CardThumbTile — E-13, AC-09(h) ════════════════════════════════════════════════ */

describe("CardThumbTile (§8D.3, E-13)", () => {
  it("renders exactly one live thumb card", () => {
    renderWithProviders(<CardThumbTile resolved={LEDGER} href="/cards/card_minimal_demo" />);

    const roots = document.querySelectorAll("[data-card-root]");
    expect(roots).toHaveLength(1);
    expect(roots[0]).toHaveAttribute("data-render-mode", "thumb");
    expect(roots[0]).toHaveAttribute("data-template-id", LEDGER.template.id);
  });

  it("names the card, its type and its template beside the thumb", () => {
    renderWithProviders(<CardThumbTile resolved={LEDGER} href="/cards/card_minimal_demo" />);
    const tile = document.querySelector("[data-card-tile]") as HTMLElement;

    expect(within(tile).getByRole("link", { name: LEDGER.cardName })).toHaveAttribute(
      "href",
      "/cards/card_minimal_demo",
    );
    expect(tile.querySelector("[data-card-type]")).toHaveTextContent(
      CARD_TYPE_LABELS[LEDGER.cardType],
    );
    expect(tile.querySelector("[data-card-tile-template]")).toHaveTextContent(
      LEDGER.template.name,
    );
    expect(tile.querySelector("[data-field-count-meter]")).toHaveAttribute(
      "data-field-count",
      String(LEDGER.fieldCount),
    );
  });

  it("clamps a 40+ character name to one line and keeps the full text in title (E-13)", () => {
    renderWithProviders(<CardThumbTile resolved={LONG} href="/cards/card_t17_long" />);
    const name = document.querySelector("[data-card-tile-name]") as HTMLElement;

    expect(LONG.cardName.length).toBeGreaterThan(40);
    expect(LONG.fullName).toBe(LONG_NAME);
    expect(name).toHaveAttribute("data-tile-clamp", "1");
    expect(name).toHaveClass("line-clamp-1");
    expect(name).toHaveAttribute("title", LONG.cardName);
  });

  it("keeps its grid cell — the tile never widens to its content (E-13)", () => {
    renderWithProviders(<CardThumbTile resolved={LONG} href="/cards/card_t17_long" />);
    const tile = document.querySelector("[data-card-tile]") as HTMLElement;

    // A grid item's automatic minimum size is its content, so a 42-character unbroken
    // caption reflows the whole grid unless the cell is allowed to shrink below it.
    expect(tile).toHaveClass("min-w-0");
    expect(tile).toHaveClass("w-full");
  });

  it("shows the zero-field warning badge on an empty card (AC-36)", () => {
    renderWithProviders(<CardThumbTile resolved={EMPTY} href="/cards/card_empty_demo" />);
    const badge = document.querySelector("[data-field-count-meter]");

    expect(badge).toHaveAttribute("data-field-count", "0");
    expect(badge).toHaveAttribute("data-tone", "warning");
    expect(badge).toHaveTextContent("0 fields");
  });

  it("hides the decorative thumb from assistive technology and offers no control", () => {
    renderWithProviders(<CardThumbTile resolved={LEDGER} href="/cards/card_minimal_demo" />);
    const preview = document.querySelector("[data-card-tile-preview]") as HTMLElement;

    expect(preview).toHaveAttribute("aria-hidden", "true");
    // aria-hidden over a focusable descendant is an axe violation in its own right.
    expect(preview.querySelectorAll("a, button, input, select, textarea")).toHaveLength(0);
    // One tab stop per tile: the name.
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("encodes the card's OWN payload in the thumb, not a dummy", () => {
    renderWithProviders(<CardThumbTile resolved={LEDGER} href="/cards/card_minimal_demo" />);

    const zone = document.querySelector("[data-qr-zone]");
    expect(zone).toHaveAttribute("data-qr-mode", "thumb");
    expect(zone).toHaveAttribute("aria-hidden", "true");
    /* No `data-qr-preview` any more: the tile used to carry a fixed dummy string so a scanned
       gallery preview could not resolve to a real card. The card in a tile is the viewer's
       own, so resolving to it is correct — and a symbol encoding a lie is worse than a small
       true one, because an enlarged or exported tile then decodes to nothing meaningful. */
    expect(zone).not.toHaveAttribute("data-qr-preview");
    expect(document.querySelector("[data-qr-symbol]")).not.toBeNull();
  });

  it("renders a non-navigating tile when no href is given", () => {
    renderWithProviders(<CardThumbTile resolved={LEDGER} />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(document.querySelector("[data-card-tile-name]")).toHaveTextContent(LEDGER.cardName);
  });
});

/* ══ CardTypeChip ══════════════════════════════════════════════════════════════════ */

describe("CardTypeChip (§8D.3, §8.6)", () => {
  const TYPES: readonly CardType[] = ["BUSINESS", "PERSONAL", "PAYMENT", "CUSTOM"];

  it("labels every CardType", () => {
    for (const type of TYPES) {
      const { unmount } = renderWithProviders(<CardTypeChip type={type} />);
      const chip = document.querySelector("[data-card-type]");

      expect(chip, type).toHaveAttribute("data-card-type", type);
      expect(chip, type).toHaveTextContent(CARD_TYPE_LABELS[type]);
      unmount();
    }
  });

  it("is a --radius-full pill on the --accent-wash ground", () => {
    renderWithProviders(<CardTypeChip type="BUSINESS" />);
    const chip = document.querySelector("[data-card-type]") as HTMLElement;

    expect(chip.className).toContain("rounded-full");
    expect(chip.className).toContain("bg-accent-wash");
  });

  it("is never a control — a card type is a fact, not a filter", () => {
    renderWithProviders(<CardTypeChip type="PAYMENT" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

/* ══ ContactRow ════════════════════════════════════════════════════════════════════ */

/**
 * `SourceCardLink`'s describe block used to sit above this one. Both the component and its tests
 * are gone: a contact has no source card any more, because a contact is somebody you send *to*
 * rather than somebody who scanned something. See `types/domain.ts`.
 */
describe("ContactRow (§8D.3)", () => {
  const arjun = fixtureContacts.find((c) => c.id === "contact_arjun") as Contact;
  const unnamed = fixtureContacts.find((c) => c.id === "contact_unnamed") as Contact;
  const optedOut = fixtureContacts.find((c) => c.id === "contact_opted_out") as Contact;

  it("renders the name, the number and the added date", () => {
    renderWithProviders(
      <ul>
        <ContactRow contact={arjun} href={`/contacts/${arjun.id}`} />
      </ul>,
    );

    const row = document.querySelector("[data-contact-row]") as HTMLElement;
    expect(row).toHaveAttribute("data-contact-row", arjun.id);
    expect(
      within(row).getByRole("link", { name: arjun.displayName as string }),
    ).toHaveAttribute("href", `/contacts/${arjun.id}`);
    expect(row.querySelector("[data-contact-phone]")).not.toBeNull();

    const added = row.querySelector("time");
    expect(added).toHaveAttribute("dateTime", arjun.createdAt);
    expect(added).toHaveTextContent("20 August 2026");
  });

  it("falls back to the number when there is no name, and shows it only once", () => {
    // An import routinely brings a number with no name. A blank cell where a name should be
    // reads as a broken row — and printing the number twice reads as a bug too.
    renderWithProviders(
      <ul>
        <ContactRow contact={unnamed} href={`/contacts/${unnamed.id}`} />
      </ul>,
    );

    const row = document.querySelector("[data-contact-row]") as HTMLElement;
    expect(within(row).getByRole("link")).toHaveTextContent(unnamed.phoneE164);
    expect(row.querySelector("[data-contact-phone]")).toBeNull();
  });

  it("badges an opted-out contact, because it changes what you may do next", () => {
    renderWithProviders(
      <ul>
        <ContactRow contact={optedOut} href={`/contacts/${optedOut.id}`} />
      </ul>,
    );

    const row = document.querySelector("[data-contact-row]") as HTMLElement;
    expect(row).toHaveAttribute("data-contact-opted-out", "");
    expect(row.querySelector("[data-contact-opted-out-badge]")).toHaveTextContent("Opted out");
  });

  it("leaves the badge off a contact who has not opted out", () => {
    renderWithProviders(
      <ul>
        <ContactRow contact={arjun} />
      </ul>,
    );
    const row = document.querySelector("[data-contact-row]") as HTMLElement;
    expect(row).not.toHaveAttribute("data-contact-opted-out");
    expect(row.querySelector("[data-contact-opted-out-badge]")).toBeNull();
  });

  it("stacks below 768px and lays out in a row above it", () => {
    renderWithProviders(
      <ul>
        <ContactRow contact={arjun} />
      </ul>,
    );

    const row = document.querySelector("[data-contact-row]") as HTMLElement;
    expect(row.className).toContain("flex-col");
    expect(row.className).toContain("md:flex-row");
  });

  it("is a list item by default, so a screen reader hears a list", () => {
    renderWithProviders(
      <ul>
        <ContactRow contact={arjun} />
      </ul>,
    );
    expect(screen.getByRole("listitem")).toHaveAttribute("data-contact-row", arjun.id);
  });
});

describe("StatRow (§8D.3)", () => {
  const STATS = [
    { id: "cards", label: "Cards", value: 8, href: "/cards" },
    { id: "contacts", label: "Contacts", value: 12, href: "/contacts" },
    { id: "fields", label: "Fields", value: 35 },
  ] as const;

  it("renders three hairline-ruled stat blocks", () => {
    renderWithProviders(<StatRow stats={STATS} />);
    const row = document.querySelector("[data-stat-row]") as HTMLElement;

    expect(row.querySelectorAll("[data-stat]")).toHaveLength(3);
    expect(row.className).toContain("border-line");
  });

  it("sets numerals in tabular figures so the blocks align", () => {
    renderWithProviders(<StatRow stats={STATS} />);

    for (const stat of STATS) {
      const block = document.querySelector(`[data-stat="${stat.id}"]`) as HTMLElement;
      const value = block.querySelector("[data-stat-value]") as HTMLElement;

      expect(value, stat.id).toHaveTextContent(String(stat.value));
      expect(value.className, stat.id).toContain("tabular-nums");
      expect(block).toHaveTextContent(stat.label);
    }
  });

  it("links only the blocks that were given a destination", () => {
    renderWithProviders(<StatRow stats={STATS} />);

    expect(screen.getByRole("link", { name: /Cards/ })).toHaveAttribute("href", "/cards");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});

/* ══ FieldList — §6.6, §7.3, AC-32, AC-33 ══════════════════════════════════════════ */

describe("FieldList (§6.6, §7.3)", () => {
  it("renders one row per field, in the order resolveCard produced", () => {
    const { container } = renderWithProviders(<FieldList fields={MIXED_ALL} />);
    expect(fieldRowIds(container)).toEqual(MIXED_ALL.map((field) => field.id));
  });

  it("never re-sorts within a category — the card and the .vcf must not diverge", () => {
    // Two WORK fields, deliberately handed over in the reverse of `TYPE_RANK` order. A
    // second sort here is how the rendered card and the downloaded file start disagreeing.
    const work = MIXED_ALL.filter((field) => field.category === "WORK");
    expect(work.length).toBeGreaterThanOrEqual(2);

    const reversed = [...work].reverse();
    const { container } = renderWithProviders(<FieldList fields={reversed} />);
    expect(fieldRowIds(container)).toEqual(reversed.map((field) => field.id));
  });

  it("groups by FieldCategory in declaration order", () => {
    const { container } = renderWithProviders(<FieldList fields={PAYMENTS.fields} />);
    const order: FieldCategory[] = ["IDENTITY", "PERSONAL", "WORK", "BUSINESS", "SOCIAL", "FINANCIAL", "CUSTOM"];

    const rendered = [...container.querySelectorAll("[data-field-group]")].map(
      (node) => node.getAttribute("data-field-group") as FieldCategory,
    );
    expect(rendered.length).toBeGreaterThan(1);
    expect(rendered).toEqual([...rendered].sort((a, b) => order.indexOf(a) - order.indexOf(b)));

    for (const category of rendered) {
      expect(container).toHaveTextContent(FIELD_CATEGORY_LABELS[category]);
    }
  });

  it("renders row.context — E-23's bare hostname reaches the DOM here or nowhere", () => {
    const { container } = renderWithProviders(<FieldList fields={MIXED_ALL} />);

    const mastodon = container.querySelector('[data-field-row="field_mastodon"]') as HTMLElement;
    expect(mastodon.querySelector("[data-field-context]")).toHaveTextContent("mastodon.example");
  });

  it("carries rel=noopener noreferrer on every external destination (AC-32)", () => {
    const { container } = renderWithProviders(<FieldList fields={MIXED_ALL} />);
    const anchors = [...container.querySelectorAll("a")];
    expect(anchors.length).toBeGreaterThan(0);

    for (const anchor of anchors) {
      if (anchor.getAttribute("target") === "_blank") {
        expect(anchor, anchor.getAttribute("href") ?? "").toHaveAttribute(
          "rel",
          "noopener noreferrer",
        );
      }
    }

    const site = container.querySelector('[data-field-row="field_site_url"] a') as HTMLElement;
    expect(site).toHaveAttribute("target", "_blank");
    expect(site).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("masks the financial rows and publishes no raw value anywhere (AC-33)", () => {
    const { container } = renderWithProviders(<FieldList fields={PAYMENTS.fields} />);

    const bank = container.querySelector('[data-field-row="field_bank"]') as HTMLElement;
    expect(bank).toHaveAttribute("data-field-masked");
    expect(bank).toHaveTextContent("••••5678");

    for (const raw of [
      "50100412345678",
      "0x8f2A55949038A501f5B7C0e1B4d8b9C3A2e4d612",
      "priyanka@okhdfcbank",
      "HDFC0000123",
    ]) {
      expect(container.innerHTML, raw).not.toContain(raw);
    }
  });

  it("offers no reveal control and no destination on a masked row (§7.3)", () => {
    const { container } = renderWithProviders(<FieldList fields={PAYMENTS.fields} />);

    for (const row of container.querySelectorAll("[data-field-masked]")) {
      expect(row.querySelectorAll("a, button")).toHaveLength(0);
      expect(row).not.toHaveAttribute("title");
      expect(row.querySelector("[data-field-value]")).not.toHaveAttribute("title");
    }
    // The whole list: a reveal affordance exists only in `/profile` (T25), never here.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("keeps the non-secret context beside a masked row", () => {
    const { container } = renderWithProviders(<FieldList fields={PAYMENTS.fields} />);
    const bank = container.querySelector('[data-field-row="field_bank"]') as HTMLElement;
    expect(bank.querySelector("[data-field-context]")).toHaveTextContent("HDFC Bank");
  });

  it("renders a LOCATION_TRACKING status and never a coordinate (§7.3)", () => {
    const coordinate: ResolvedField = {
      id: "field_t17_location",
      type: "LOCATION_TRACKING",
      category: "PERSONAL",
      label: "Live location",
      value: "19.0760, 72.8777",
      isSensitive: false,
    };

    const { container } = renderWithProviders(<FieldList fields={[coordinate]} />);
    expect(container).toHaveTextContent("Location sharing on");
    expect(container.innerHTML).not.toContain("19.0760");
    expect(container.innerHTML).not.toContain("72.8777");

    // §6.6: a status chip, and a chip is a --radius-full pill (§8.6).
    const status = container.querySelector("[data-field-status]") as HTMLElement;
    expect(status).toHaveTextContent("Location sharing on");
    expect(status.className).toContain("rounded-full");
  });

  it("masks a sensitive status row without letting the chip route around it", () => {
    // The status branch renders before the masked branch, so it is the one place a raw
    // value could slip past `masked`. T12 masks the display first; this asserts it holds.
    const sensitiveLocation: ResolvedField = {
      id: "field_t17_secret_location",
      type: "LOCATION_TRACKING",
      category: "PERSONAL",
      label: "Live location",
      value: "19.0760, 72.8777",
      isSensitive: true,
    };

    const { container } = renderWithProviders(<FieldList fields={[sensitiveLocation]} />);
    const row = container.querySelector("[data-field-masked]") as HTMLElement;

    expect(row).not.toBeNull();
    expect(container.innerHTML).not.toContain("19.0760");
    expect(row.querySelector("[data-field-value]")).not.toHaveAttribute("title");
    expect(row.querySelectorAll("a, button")).toHaveLength(0);
  });

  it("drops PHOTO and blank values rather than rendering an empty row (E-07)", () => {
    const photo: ResolvedField = {
      id: "field_t17_photo",
      type: "PHOTO",
      category: "IDENTITY",
      label: "Portrait",
      value: "/portraits/priyanka.png",
      isSensitive: false,
    };
    const blank: ResolvedField = {
      id: "field_t17_blank",
      type: "TEXT",
      category: "IDENTITY",
      label: "Note",
      value: "   ",
      isSensitive: false,
    };

    const { container } = renderWithProviders(
      <FieldList fields={[photo, blank, ...MIXED_ALL]} />,
    );
    expect(fieldRowIds(container)).toEqual(MIXED_ALL.map((field) => field.id));
  });

  it("renders nothing when every field resolves to no row", () => {
    const { container } = renderWithProviders(<FieldList fields={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("can drop the category headings for a surface that has one group", () => {
    const { container } = renderWithProviders(
      <FieldList fields={MIXED_ALL} showHeadings={false} />,
    );
    expect(container.querySelectorAll("h3")).toHaveLength(0);
    expect(fieldRowIds(container)).toEqual(MIXED_ALL.map((field) => field.id));
  });

  /**
   * The `savedContactFields` test that stood here is gone with its adapter.
   *
   * It turned a saved contact's denormalised snapshot into `ResolvedField`s so this list could
   * render somebody else's details. The API's contact has no fields at all — it is a number you
   * send to — so there is no snapshot to adapt, and the second grouping table that adapter
   * needed is no longer a thing that can drift from the real one.
   *
   * `FieldList` itself is unchanged and still serves `/cards/[cardId]` and the public card.
   */
});

/* ══ The barrel ════════════════════════════════════════════════════════════════════ */

describe("The barrel (@/components/app)", () => {
  it("exports all six components", () => {
    for (const name of [
      "StatRow",
      "CardThumbTile",
      "ContactRow",
      "FieldList",
      "FieldCountMeter",
      "CardTypeChip",
    ]) {
      expect(barrel, `missing export: ${name}`).toHaveProperty(name);
    }
  });

  it("exports the helpers the screen tracks need beside them", () => {
    for (const name of [
      "fieldCountLabel",
      "CARD_TYPE_LABELS",
      "FIELD_CATEGORY_LABELS",
      "EMPTY_CARD_NOTE",
    ]) {
      expect(barrel, `missing export: ${name}`).toHaveProperty(name);
    }
  });
});

/* ══ Anti-AI lint lock + the UI-only wall ══════════════════════════════════════════ */

describe("Anti-AI lint lock for src/components/app (F-01, F-04, F-05, F-09, F-10, F-11)", () => {
  const dir = resolvePath(process.cwd(), "src/components/app");
  const sources = readdirSync(dir)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
    .map((name) => [name, readFileSync(join(dir, name), "utf8")] as const);

  it("reads the six components plus the barrel", () => {
    // Was seven plus the barrel. `source-card-link.tsx` is gone: a contact has no source card
    // now, so nothing was left for it to resolve.
    expect(sources.length).toBe(7);
  });

  it.each([
    ["colour literal (F-01)", "#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\(|oklch\\("],
    ["gradient (F-04)", "gradient"],
    ["glassmorphism (F-05)", "backdrop-(blur|filter)"],
    ["elevation (F-09)", "shadow-|box-shadow"],
    ["oversized radius (F-10)", "rounded-(2xl|3xl)"],
    ["type weight above 500 (F-11)", "font-(bold|semibold|extrabold|black)"],
  ])("contains no %s", (_label, pattern) => {
    const regex = new RegExp(pattern);
    for (const [name, source] of sources) {
      expect(regex.test(source), `${name} matched /${pattern}/`).toBe(false);
    }
  });

  it("uses no emoji as an icon or a bullet (F-07, F-08)", () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
    for (const [name, source] of sources) {
      expect(emoji.test(source), `${name} used an emoji`).toBe(false);
    }
  });

  it("contains no default Tailwind palette utility — tokens only", () => {
    const palette = new RegExp(
      "\\b(?:bg|text|border|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|" +
        "yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-",
    );
    for (const [name, source] of sources) {
      expect(palette.test(source), `${name} used a default palette utility`).toBe(false);
    }
  });

  it("reaches no network and no browser storage (§3.1, AC-06)", () => {
    const banned = new RegExp(
      "fetch\\(|axios|useSWR|useQuery|localStorage|sessionStorage|document\\.cookie",
    );
    for (const [name, source] of sources) {
      expect(banned.test(source), `${name} crossed the UI-only wall`).toBe(false);
    }
  });

  it("never injects raw HTML (AC-32)", () => {
    for (const [name, source] of sources) {
      expect(source.includes("dangerouslySetInnerHTML"), name).toBe(false);
    }
  });

  it("never pulls the card typefaces into an app bundle (AC-17, N-3)", () => {
    for (const [name, source] of sources) {
      expect(source.includes("card-fonts"), name).toBe(false);
      expect(source.includes("cardFontsClassName"), name).toBe(false);
    }
  });
});
