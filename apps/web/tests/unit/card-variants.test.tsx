import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CardPage, cardPageSurface } from "@/card/card-page";
import {
  MESH_BLOOMS,
  GROUND_PRIMARY_MIN,
  GROUND_SECONDARY_MIN,
  meshBloomHexes,
  meshBloomPercents,
  mixSrgb,
  textureDirection,
  textureEdgeAlpha,
  textureShadowAlpha,
} from "@/card/card-ground";
import {
  FINISH_ORDER,
  TEXTURES,
  TEXTURE_EDGE_ALPHA,
  TEXTURE_ORDER,
  TEXTURE_PRESENCE_ORDER,
  TEXTURE_SCALE,
  resolveCardSurface,
  type CardSurface,
} from "@/card/card-surface";
import { contrastRatio } from "@/lib/contrast";
import {
  actionAccessibleName,
  cardPageRows,
  classifyFieldRow,
  type CardPageRowKind,
} from "@/card/card-page-rows";
import type { FieldRow } from "@/card/field-renderers";
import { FACE_HEIGHT, FACE_WIDTH, MAX_DETAIL_PAIRS, ShareFace } from "@/card/share-face";
import { CARD_LINK_DISPLAY_HOST, formatCardLink } from "@/lib/format";
import { CardActionButton } from "@/card/card-action-button";
import { PALETTE_ORDER, TEMPLATE_PALETTES, type TemplatePalette } from "@/card/template-palettes";
import { TEMPLATES, TEMPLATE_ORDER } from "@/card/templates";
import { resolveCard } from "@/card/resolve-card";
import { cardLedgerDemo, fixtureCards } from "@/fixtures/cards";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import { fixtureUser } from "@/fixtures/user";
import type { ContactCard, ResolvedCard } from "@/types/domain";
import type { TemplateId } from "@/card/template-types";

/**
 * The regression guard for the defect that forced this rebuild.
 *
 * The previous build rendered one 400×860 canvas for every purpose. It had to hold the
 * identity block, a QR with a 196px protected zone, two action buttons, and however many
 * fields the owner had mapped — which does not fit, so the field list was given
 * `overflow-y: auto`. The result shipped: a scrollbar inside a small card, a "5 fields" label
 * above four visible rows, truncated wallet addresses, clipped labels.
 *
 * No amount of CSS review catches that, because each individual rule is reasonable. What
 * catches it is asserting the two structural properties the design depends on:
 *
 *   1. the PAGE variant declares as many field rows as it renders, and contains no scroll
 *      container anywhere in its subtree;
 *   2. the FACE variant renders no field list at all, and never more than two highlights.
 *
 * Those two together make the old bug unexpressible: the list cannot be clipped on the page
 * because nothing scrolls, and it cannot be clipped on the face because it is not there.
 *
 * happy-dom has no layout engine, so nothing here asserts geometry — these are structural
 * claims, which is precisely what makes them testable without a browser. The pixel-level
 * claims (symbol size, quiet zone, decode) live in the Playwright suites.
 */

const CARD_BY_ID = new Map(fixtureCards.map((c) => [c.id, c]));

function resolveFixture(cardId: string, templateId?: TemplateId): ResolvedCard {
  const card = CARD_BY_ID.get(cardId);
  if (card === undefined) throw new Error(`no fixture card ${cardId}`);
  const target: ContactCard = templateId === undefined ? card : { ...card, templateId };
  return resolveCard(target, fixtureUser, fixtureGroups, fixtureFields);
}

/** The fixture with the most mapped fields — the one the old fixed canvas could not hold. */
const RICHEST = [...fixtureCards].sort((a, b) => b.fieldIds.length - a.fieldIds.length)[0];

describe("the card page never clips the owner's fields", () => {
  it.each(TEMPLATE_ORDER)("%s renders every field it declares", (templateId) => {
    const resolved = resolveFixture(RICHEST.id, templateId);
    const { container } = render(<CardPage resolved={resolved} />);

    const list = container.querySelector("[data-card-fields]");
    if (resolved.fields.length === 0) {
      expect(list).toBeNull();
      return;
    }

    const declared = Number(list?.getAttribute("data-field-count"));
    const rendered = container.querySelectorAll("[data-card-field-row]").length;

    /* The exact assertion the old build would have failed: it declared 5 and painted 4. */
    expect(rendered).toBe(declared);
    expect(rendered).toBeGreaterThan(0);
  });

  /**
   * The structural claim, stated as an absence.
   *
   * An inline `overflow` on any element inside the card page is the mechanism by which the
   * previous build clipped its own content, so the page is asserted to contain none. A future
   * edit that adds `overflow: auto` to make something "fit" fails here, which is the only
   * moment anyone would think to do it.
   */
  it.each(TEMPLATE_ORDER)("%s contains no scroll container", (templateId) => {
    const resolved = resolveFixture(RICHEST.id, templateId);
    const { container } = render(<CardPage resolved={resolved} />);

    const root = container.querySelector('[data-card-variant="page"]');
    expect(root).not.toBeNull();

    const scrollers = [...(root as Element).querySelectorAll<HTMLElement>("*")].filter((el) => {
      const inline = el.getAttribute("style") ?? "";
      return /overflow(-[xy])?\s*:\s*(auto|scroll)/.test(inline);
    });

    expect(
      scrollers.map((el) => el.tagName),
      "the card page must grow, never scroll internally",
    ).toEqual([]);
  });

  it("carries no fixed height that a field list could overflow", () => {
    const resolved = resolveFixture(RICHEST.id, "meridian");
    const { container } = render(<CardPage resolved={resolved} />);
    const root = container.querySelector('[data-card-variant="page"]') as HTMLElement;

    const inline = root.getAttribute("style") ?? "";
    expect(inline).not.toMatch(/(^|;)\s*height\s*:/);
    expect(inline).not.toMatch(/max-height\s*:/);
  });
});

/* ── the stack: what a field becomes, and what it must never become ─────────────────── */

/** The masking card — `BANK_ACCOUNT` + `DIGITAL_WALLET` + `CRYPTO_WALLET`, plus a live PHONE. */
const FINANCIAL_CARD = "card_cobalt_demo";

/** §8.8's middle icon size, matching the one `<CardPage>` asks the registry for. */
const ROW_ICON_SIZE = 20;

/**
 * A hand-built row, so the classifier can be asked questions no fixture can pose.
 *
 * The important one is `{ masked: true, href: "mailto:…" }`. `field-renderers.tsx` cannot
 * currently produce that — masking is applied last and surrenders the href with the display —
 * which is exactly why the case has to be constructed here: the guarantee under test is what
 * happens *if that ever stops being true*, and a fixture can only ever exercise today's
 * renderer.
 */
function fakeRow(overrides: Partial<FieldRow> = {}): FieldRow {
  return {
    icon: null,
    label: "Work email",
    display: "priyanka@fernwood.example",
    lines: ["priyanka@fernwood.example"],
    title: "priyanka@fernwood.example",
    context: null,
    href: null,
    external: false,
    masked: false,
    variant: "text",
    ...overrides,
  };
}

describe("the row classifier decides what a field becomes", () => {
  it("a row with a destination is a button", () => {
    expect(classifyFieldRow(fakeRow({ href: "mailto:priyanka@fernwood.example" }))).toBe("action");
  });

  it("a row with no destination is quiet text, not a dead button", () => {
    /* A job title has nowhere to go. Dressing it as a control teaches the reader that the
       eight real controls above it might not work either. */
    expect(classifyFieldRow(fakeRow({ label: "Role", display: "Head of Partnerships" }))).toBe(
      "note",
    );
  });

  it("a masked row stays masked even if a destination somehow survived (§7.3, AC-33)", () => {
    /* The fail-safe ordering, pinned. If masking ever stopped stripping the href, the worst
       outcome must be un-tappable text — never a live link to the value being masked. */
    expect(classifyFieldRow(fakeRow({ masked: true, href: "mailto:leak@example.com" }))).toBe(
      "masked",
    );
  });

  it("names the destination for assistive tech without printing it", () => {
    expect(actionAccessibleName(fakeRow({ href: "mailto:x" }))).toBe(
      "Work email: priyanka@fernwood.example",
    );
  });

  it("does not say the same word twice when the value is its own label", () => {
    expect(actionAccessibleName(fakeRow({ label: "Podcast", display: "Podcast" }))).toBe("Podcast");
  });

  it("keeps the resolver's order, so the page and the .vcf agree", () => {
    const resolved = resolveFixture(RICHEST.id);
    /* The page's own input: `fields` **then** `socialFields`, mirroring `buildVcf`'s
       concatenation exactly. Feeding this only `fields` is what let the social-link gap hide. */
    const rows = cardPageRows(
      [...resolved.fields, ...resolved.socialFields],
      ROW_ICON_SIZE,
    );

    /* Only rows the registry declined are missing — `PHOTO`, and blank values (E-07) —
       and nothing has been re-sorted into "buttons first". */
    const ids = rows.map((entry) => entry.field.id);
    expect(ids).toEqual(
      [...resolved.fields, ...resolved.socialFields]
        .filter((f) => f.type !== "PHOTO")
        .map((f) => f.id),
    );
  });
});

describe("the card page is a stack of buttons, not a list of values", () => {
  /**
   * ⚠ **The instruction most likely to be "fixed" by a future reader, pinned as a test.**
   *
   * The card shows "Work email", not the address. A button's job is what it does, and a stack
   * of buttons each wearing a 34-character address is the labelled `LABEL / value` list this
   * design replaced. Asserting exact equality — not merely "does not contain the value" —
   * is what makes adding the value back a red test rather than a judgement call in review.
   */
  it("prints the owner's label on an action button and nothing else", () => {
    const resolved = resolveFixture(RICHEST.id);
    const { container } = render(<CardPage resolved={resolved} />);
    /* `fields` **and** `socialFields` — the same concatenation `<CardPage>` and `buildVcf` use.
       Building this map from `fields` alone left every social button (LinkedIn, Instagram, X…)
       without an entry, which is how the social-link gap stayed invisible in the first place. */
    const rows = new Map(
      cardPageRows([...resolved.fields, ...resolved.socialFields], ROW_ICON_SIZE).map((e) => [
        e.field.id,
        e,
      ]),
    );

    const buttons = [...container.querySelectorAll<HTMLAnchorElement>("[data-card-action-button]")];
    expect(buttons.length).toBeGreaterThan(0);

    for (const button of buttons) {
      const entry = rows.get(button.dataset.cardActionButton ?? "");
      expect(entry, button.outerHTML).toBeDefined();
      const row = (entry as NonNullable<typeof entry>).row;

      expect(button.textContent?.trim()).toBe(row.label);
      /* …and the value is reachable, just not painted. */
      expect(button.getAttribute("aria-label")).toContain(row.display);
    }
  });

  it("follows the renderer's href, and never invents one", () => {
    const resolved = resolveFixture(RICHEST.id);
    const { container } = render(<CardPage resolved={resolved} />);

    for (const entry of cardPageRows(resolved.fields, ROW_ICON_SIZE)) {
      const button = container.querySelector<HTMLAnchorElement>(
        `[data-card-action-button="${entry.field.id}"]`,
      );
      if (entry.kind !== "action") {
        expect(button, `${entry.field.type} is ${entry.kind} and must not be tappable`).toBeNull();
        continue;
      }
      expect(button).not.toBeNull();
      expect(button?.tagName).toBe("A");
      expect(button?.getAttribute("href")).toBe(entry.row.href);
      /* AC-32: anything leaving the app leaves without an opener handle. */
      if (entry.row.external) {
        expect(button?.getAttribute("rel")).toBe("noopener noreferrer");
        expect(button?.getAttribute("target")).toBe("_blank");
      }
    }
  });

  /**
   * An `<a>`, never a `<button>`, and the reason is a live assertion elsewhere.
   *
   * `tests/e2e/public-card.spec.ts` proves AC-33 partly by counting `button` elements inside
   * the card root: exactly one, the Save action, because a reveal control would show up as a
   * second. Field rows are navigations, so making them buttons would break that count while
   * changing nothing a user can see — the worst kind of regression.
   */
  it("renders no button element of its own, on any template", () => {
    for (const templateId of TEMPLATE_ORDER) {
      const resolved = resolveFixture(RICHEST.id, templateId);
      const { container } = render(<CardPage resolved={resolved} />);
      expect(container.querySelectorAll("button"), templateId).toHaveLength(0);
    }
  });

  it("classifies every row, and publishes which shape it took", () => {
    const resolved = resolveFixture(FINANCIAL_CARD);
    const { container } = render(<CardPage resolved={resolved} />);

    const kinds = [...container.querySelectorAll<HTMLElement>("[data-card-field-row]")].map(
      (li) => li.dataset.cardRowKind as CardPageRowKind,
    );

    /* In §6.4's order: work mobile → `tel:`; company (no destination) → note; UPI, bank and
       crypto → masked. The order is the resolver's, not a re-sort that puts buttons first. */
    expect(kinds).toEqual(["action", "note", "masked", "masked", "masked"]);
    expect(container.querySelectorAll("[data-card-field-masked]")).toHaveLength(3);
  });

  it("gives a masked field no link and never its raw value (§7.3, AC-33)", () => {
    const resolved = resolveFixture(FINANCIAL_CARD);
    const { container } = render(<CardPage resolved={resolved} />);
    const html = container.innerHTML;

    for (const field of resolved.fields) {
      const row = container.querySelector<HTMLElement>(`[data-card-field="${field.id}"]`);
      if (row?.dataset.cardRowKind !== "masked") continue;

      /* Not a link, not a button, not a control of any kind. */
      expect(row.querySelectorAll("a")).toHaveLength(0);
      expect(row.querySelectorAll("[data-card-action-button]")).toHaveLength(0);
      /* The masked string is shown… */
      expect(row.querySelector("[data-card-field-value]")?.textContent).toContain("••••");
      /* …and the value it masks appears nowhere in the markup — not as text, not in a
         `title`, not in an `aria-label`, not in an `href`. `innerHTML` is asserted rather
         than `textContent` precisely because attributes are where it would hide. */
      expect(html, field.id).not.toContain(field.value);
    }
  });

  it("keeps a descriptive field readable as text", () => {
    /* The `LOCATION_TRACKING` chip is the sharpest case: it has a value worth reading and
       must never become a control, because §7.3 scrubbed it to a status precisely so it has
       nowhere to go. */
    const resolved = resolveFixture("card_ember_demo");
    const { container } = render(<CardPage resolved={resolved} />);
    const row = container.querySelector<HTMLElement>('[data-card-field="field_location"]');

    expect(row?.dataset.cardRowKind).toBe("note");
    expect(row?.querySelector("[data-card-note]")).not.toBeNull();
    expect(row?.textContent).toContain("Sharing with saved contacts");
    expect(row?.querySelectorAll("a")).toHaveLength(0);
  });

  it("wears the Contact Book mark at the top, and does not make it a second way out", () => {
    const resolved = resolveFixture(RICHEST.id);
    const { container } = render(<CardPage resolved={resolved} />);
    const brand = container.querySelector("[data-card-brand]");

    expect(brand?.textContent).toBe("Contact Book");
    /* §8D.5 gives this page exactly one exit — the caption beneath the card. A link here,
       above the owner's own name, would be the product advertising itself louder than the
       person whose card this is. */
    expect(brand?.closest("a")).toBeNull();
    expect(container.querySelector("[data-card-hero]")?.contains(brand)).toBe(true);
  });

  it("paints the stack from the card's own palette, never from a hard-coded colour", () => {
    /* `card_cobalt_demo` is Oxblood on Meridian, whose default is Sapphire. Every colour on
       the stack must arrive through the `--c-*` custom properties the root declares, so the
       card's own choice reaches the buttons; a literal here would ignore it. */
    const resolved = resolveFixture(FINANCIAL_CARD);
    expect(resolved.palette.id).toBe("oxblood");
    expect(resolved.template.paletteId).toBe("sapphire");

    const { container } = render(<CardPage resolved={resolved} />);
    const root = container.querySelector('[data-card-variant="page"]') as HTMLElement;
    expect(root.getAttribute("style")).toContain(`--c-ground: ${TEMPLATE_PALETTES.oxblood.ground}`);

    for (const el of root.querySelectorAll<HTMLElement>("[data-card-action-button], [data-card-note]")) {
      const style = el.getAttribute("style") ?? "";
      expect(style, el.outerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(style, el.outerHTML).not.toMatch(/\brgba?\(/i);
    }
  });
});

describe("the share face carries a QR and never a field list", () => {
  it.each(TEMPLATE_ORDER)("%s renders exactly one QR zone", (templateId) => {
    const resolved = resolveFixture(RICHEST.id, templateId);
    const { container } = render(<ShareFace resolved={resolved} mode="full" />);

    expect(container.querySelectorAll("[data-qr-zone]")).toHaveLength(1);
  });

  /**
   * **The other half of the split, and the newer half: the page carries NO QR.**
   *
   * `<CardPage>` used to end with a `<QrZone>`, on the argument that a scanned card is also a
   * re-shareable card. It is not — whoever is reading the page already has the card open, so
   * that symbol pointed at the page they were on. The QR is the *face's* job, because the face
   * is the thing that gets handed over.
   *
   * Asserted here as a pair, in one file, because "which variant carries the symbol" is exactly
   * the sort of fact that gets half-changed. Both directions have to hold: a QR that reappeared
   * on the page, and a QR that vanished from the face, are each a one-line edit away and each
   * fails here. The pixel-level claims about the face's symbol — size, quiet zone, decode — are
   * the Playwright suites' (`tests/e2e/qr-*.spec.ts`, all now measuring `/cards/{id}`).
   */
  it.each(TEMPLATE_ORDER)("%s puts the QR on the face and nowhere on the page", (templateId) => {
    const resolved = resolveFixture(RICHEST.id, templateId);

    const face = render(<ShareFace resolved={resolved} mode="full" />).container;
    expect(face.querySelectorAll("[data-qr-zone]")).toHaveLength(1);
    expect(face.querySelectorAll("[data-qr-symbol]")).toHaveLength(1);

    const page = render(<CardPage resolved={resolved} />).container;
    expect(page.querySelectorAll("[data-qr-zone]")).toHaveLength(0);
    expect(page.querySelectorAll("[data-qr-symbol]")).toHaveLength(0);
    expect(page.querySelectorAll("[data-qr-plate]")).toHaveLength(0);
    /* Not even the E-30 fallback plate or a caption — the component is not rendered at all. */
    expect(page.querySelectorAll("[data-qr-caption]")).toHaveLength(0);
  });

  it.each(TEMPLATE_ORDER)("%s renders no field list on the face", (templateId) => {
    const resolved = resolveFixture(RICHEST.id, templateId);
    const { container } = render(<ShareFace resolved={resolved} mode="full" />);

    /* The whole architectural point. The list belongs to the page. */
    expect(container.querySelector("[data-card-fields]")).toBeNull();
    expect(container.querySelectorAll("[data-card-field-row]")).toHaveLength(0);
  });

  /**
   * The face's content is BOUNDED, and the bound is what keeps it a pass.
   *
   * The format carries at most `MAX_DETAIL_PAIRS` of the owner's fields — two, matching the
   * reference card's PHONE and EMAIL — followed by the card's own link. That is the whole of it.
   *
   * The bound is the load-bearing part. An earlier version had no cap and put four labelled
   * rows on the face, producing a card reading "WORK EMAIL / … / STUDIO / 4th Floor, Raheja
   * Titanium, Goregaon East, Mumbai…" clipped at both edges. Capping it is what makes the
   * vertical budget solvable at all: identity, pairs and the QR's reserved box have to coexist
   * on a fixed-height canvas, and an unbounded list cannot.
   */
  it.each(TEMPLATE_ORDER)("%s shows at most two detail pairs, plus the link", (templateId) => {
    const resolved = resolveFixture(RICHEST.id, templateId);
    const { container } = render(<ShareFace resolved={resolved} mode="full" />);

    /* The richest fixture is used deliberately: if the cap could be exceeded, the card with the
       most fields mapped to it is where it would happen. */
    expect(resolved.fields.length).toBeGreaterThan(MAX_DETAIL_PAIRS + 1);

    const pairs = container.querySelectorAll("[data-card-pair]");
    expect(pairs.length).toBeLessThanOrEqual(MAX_DETAIL_PAIRS + 1);

    /* The link is always the last pair, on every template. */
    const labels = [...pairs].map((el) =>
      (el.querySelector("[data-card-pair-label]")?.textContent ?? "").toLowerCase(),
    );
    expect(labels.at(-1)).toBe("link");
  });

  it.each(TEMPLATE_ORDER)("%s never puts a sensitive field on the face", (templateId) => {
    const resolved = resolveFixture(RICHEST.id, templateId);
    const { container } = render(<ShareFace resolved={resolved} mode="full" />);
    const text = container.textContent ?? "";

    /* A face is photographed, printed and left on desks. A masked account number on it says
       nothing useful while still announcing that an account number exists. */
    const leaked = resolved.fields
      .filter((f) => f.isSensitive)
      .filter((f) => f.value.length > 4 && text.includes(f.value));
    expect(leaked.map((f) => f.type)).toEqual([]);
  });

  it.each(TEMPLATE_ORDER)("%s never lets a value wrap onto a second line", (templateId) => {
    const resolved = resolveFixture(RICHEST.id, templateId);
    const { container } = render(<ShareFace resolved={resolved} mode="full" />);

    /* A wrapped value is the only thing that can push the QR's reserved box off a fixed-height
       canvas, and a centred wrapped value cannot ellipsise into one edge — which is precisely
       how the old face clipped an address at both ends. */
    for (const el of container.querySelectorAll<HTMLElement>("[data-field-value], [data-card-link]")) {
      const style = el.getAttribute("style") ?? "";
      expect(style, el.textContent ?? "").toMatch(/white-space:\s*nowrap/);
      expect(style, el.textContent ?? "").toMatch(/text-overflow:\s*ellipsis/);
    }
  });

  /**
   * The root publishes the **resolved** palette, which is the card's own choice when it has one
   * and the template's default only when it has not.
   *
   * This asserted `TEMPLATES[templateId].paletteId` and caught a real change when the fixture
   * cards were each given a distinct `paletteId`: the showcase card now carries Emerald, so a
   * face rendered with `templateId: "marigold"` correctly published `emerald` rather than
   * Marigold's Amber default. Re-pinning it to the template default would have asserted that a
   * card's own colour is *ignored* — the precise bug the palette/template split exists to
   * prevent, and one three call sites had until recently.
   */
  it.each(TEMPLATE_ORDER)("%s declares the resolved palette on the root", (templateId) => {
    const resolved = resolveFixture(RICHEST.id, templateId);
    const { container } = render(<ShareFace resolved={resolved} mode="full" />);
    const root = container.querySelector("[data-card-root]") as HTMLElement;

    expect(root.dataset.cardVariant).toBe("face");
    expect(root.dataset.templateId).toBe(templateId);
    expect(root.dataset.paletteId).toBe(resolved.palette.id);
    /* And the card's own choice is what won, not the template's default. */
    expect(resolved.palette.id).toBe(RICHEST.paletteId ?? TEMPLATES[templateId].paletteId);
  });

  /** The other half of the same rule: a card with no colour of its own inherits the template's. */
  it.each(TEMPLATE_ORDER)("%s supplies the default for a card with no colour", (templateId) => {
    const resolved = resolveFixture(cardLedgerDemo.id, templateId);
    expect(cardLedgerDemo.paletteId).toBeUndefined();
    expect(resolved.palette.id).toBe(TEMPLATES[templateId].paletteId);
  });
});

describe("an empty card still renders both variants", () => {
  /**
   * A card with no mapped fields is a real state — the builder creates one before anything is
   * added — and it must not crash either variant. The old build reserved 196px for a QR on a
   * card with nothing else on it, which is a design smell rather than a bug; what matters here
   * is that neither variant throws and the face still carries its symbol.
   */
  const empty = fixtureCards.find((c) => c.fieldIds.length === 0);

  it.runIf(empty !== undefined)("renders a face with a QR and no highlights", () => {
    const resolved = resolveFixture((empty as ContactCard).id);
    const { container } = render(<ShareFace resolved={resolved} mode="full" />);

    expect(container.querySelectorAll("[data-qr-zone]")).toHaveLength(1);
    /* Name, link and symbol survive an empty card; only the description can be absent. */
    expect(container.textContent).toContain(resolved.fullName);
  });

  it.runIf(empty !== undefined)("renders a page with no field list at all", () => {
    const resolved = resolveFixture((empty as ContactCard).id);
    const { container } = render(<CardPage resolved={resolved} />);

    expect(container.querySelector("[data-card-fields]")).toBeNull();
    expect(container.querySelector('[data-card-variant="page"]')).not.toBeNull();
    /* A zero-field page is the one case where a stray QR would be the only thing on it, so it
       is worth stating separately: there is still none. */
    expect(container.querySelector("[data-qr-zone]")).toBeNull();
  });
});

describe("every face is the same portrait shape", () => {
  it.each(TEMPLATE_ORDER)("%s renders at exactly 336 × 500", (templateId) => {
    const resolved = resolveFixture(RICHEST.id, templateId);
    const { container } = render(<ShareFace resolved={resolved} mode="full" />);
    const root = container.querySelector("[data-card-root]") as HTMLElement;

    /* One size, no exceptions. A landscape composition existed briefly and was removed: these
       are wallet passes, and a set of cards that disagrees about its own aspect ratio cannot
       stack in a gallery, share one export size, or sit in Apple Wallet tidily. */
    expect(root.style.width).toBe(`${FACE_WIDTH}px`);
    expect(root.style.height).toBe(`${FACE_HEIGHT}px`);
  });

  it("is portrait, and taller than it is wide", () => {
    expect(FACE_WIDTH).toBe(336);
    expect(FACE_HEIGHT).toBe(500);
    expect(FACE_HEIGHT).toBeGreaterThan(FACE_WIDTH);
  });
});

describe("thumb mode", () => {
  it("renders a real QR pattern carrying the card's own payload", () => {
    /* A thumbnail is transform-scaled to roughly 200px, putting the symbol near 80px — below
       the 140px floor a camera can read — so a tile is not a scanning target; the card page is.
       That physical fact is unchanged. What changed is that the tile no longer *pretends*
       otherwise by carrying a fixed dummy string: every QR in the product now encodes the
       card's own URL, so an enlarged or exported tile decodes to something true. */
    const resolved = resolveFixture(RICHEST.id);
    const { container } = render(<ShareFace resolved={resolved} mode="thumb" thumbWidth={200} />);

    const zone = container.querySelector("[data-qr-zone]") as HTMLElement;
    expect(zone.dataset.qrMode).toBe("thumb");
    expect(zone.dataset.qrPreview).toBeUndefined();
    expect(zone.getAttribute("aria-hidden")).toBe("true");

    /* A real symbol is present... */
    expect(container.querySelector("[data-qr-symbol]")).not.toBeNull();
    /* ...and the abstract placeholder is not. */
    expect(container.querySelector("[data-qr-glyph]")).toBeNull();
  });
});

describe("the link line", () => {
  /**
   * The one place the caption and the symbol are allowed to disagree, and why.
   *
   * `resolveCard` builds `qrPayload` from `NEXT_PUBLIC_SITE_URL`, falling back to
   * `http://localhost:3000` so a QR scanned off a development screen actually resolves. The
   * caption must not repeat that: a gallery showing `localhost:3000/c/prya-hq` eight times
   * reads as a broken design rather than a dev artefact.
   */
  it("never shows a development host, on any template", () => {
    for (const templateId of TEMPLATE_ORDER) {
      const resolved = resolveFixture(RICHEST.id, templateId);
      const { container } = render(<ShareFace resolved={resolved} mode="full" />);
      const text = container.textContent ?? "";

      expect(text, templateId).not.toContain("localhost");
      expect(text, templateId).not.toContain("127.0.0.1");
      expect(text, templateId).not.toContain("http://");
      expect(text, templateId).not.toContain("https://");
    }
  });

  it("still encodes the real payload in the symbol", () => {
    /* The substitution is display-only. If it ever reached the encoder, a card scanned in
       development would resolve to a domain that does not serve it. */
    const resolved = resolveFixture(RICHEST.id, "meridian");
    expect(resolved.qrPayload).toContain("/c/");
    /* The display line strips the protocol and clamps to 34 chars, so a realistic URL is
       shown truncated — display only. What matters is that the clamp never reaches the
       encoder: `qrPayload` above is the untouched publicUrl. */
    const shown = formatCardLink(resolved.qrPayload);
    expect(shown).not.toContain("https://");
    expect(shown.startsWith(new URL(resolved.publicUrl as string).host)).toBe(true);
    expect(resolved.qrPayload).toBe(resolved.publicUrl);
    // The dev-host swap is still wired, on the one input it is for.
    expect(formatCardLink("http://localhost:3000/c/abc")).toContain(CARD_LINK_DISPLAY_HOST);
  });

  it("leaves a real production host alone", () => {
    expect(formatCardLink("https://contactbook.app/c/abc")).toBe("contactbook.app/c/abc");
    expect(formatCardLink("https://cards.acme.co/c/xyz")).toBe("cards.acme.co/c/xyz");
  });

  it("falls back rather than throwing on an unparseable payload", () => {
    /* A card must render even if the payload is malformed. Throwing here would take the whole
       face down over a caption. */
    expect(() => formatCardLink("not a url")).not.toThrow();
  });
});

describe("CardActionButton carries its own palette", () => {
  /**
   * The regression guard for an invisible button.
   *
   * These buttons appear both inside a card (`<CardPage>`'s action slot) and beside one (the
   * card-detail screen puts the save action under the face, outside its subtree). Relying on
   * inheritance works in the first position and fails silently in the second: `var(--c-ground)`
   * resolves to nothing, `background` falls back to transparent and `color` inherits the page
   * ink, giving a black-on-white label with no fill. That shipped once.
   */
  it("declares the palette custom properties on itself, not on an ancestor", () => {
    const { container } = render(
      <CardActionButton action="save" paletteId="onyx" variant="primary" shape="pill">
        Save to contacts
      </CardActionButton>,
    );
    const button = container.querySelector("[data-card-action]") as HTMLElement;
    const style = button.getAttribute("style") ?? "";

    /* Rendered with no card root anywhere above it — exactly the card-detail arrangement. */
    expect(container.querySelector("[data-card-root]")).toBeNull();
    /* Read from the palette rather than pinned to a hex: the ground is the gradient's midpoint
       now, and hard-coding it meant this test failed on a colour change rather than on a
       behaviour change. */
    const onyx = TEMPLATE_PALETTES.onyx;
    expect(style).toContain(`--c-ground: ${onyx.ground}`);
    expect(style).toContain(`--c-ink: ${onyx.ink}`);
    /* The gradient reaches the button too, so an action beside a card matches the card. */
    expect(style).toContain("--c-ground-gradient: linear-gradient(");
  });

  it.each(PALETTE_ORDER)("%s resolves a real fill for both variants", (paletteId) => {
    for (const variant of ["primary", "secondary"] as const) {
      const { container } = render(
        <CardActionButton action="save" paletteId={paletteId} variant={variant} surface="canvas" shape="pill">
          Action
        </CardActionButton>,
      );
      const style =
        (container.querySelector("[data-card-action]") as HTMLElement).getAttribute("style") ?? "";

      /* Every colour the button paints with must be declared in the same style attribute, so
         none of them can fall back to `transparent` or to an inherited page colour. */
      expect(style, `${paletteId}/${variant}`).toMatch(/--c-ground:\s*#[0-9A-F]{6}/);
      expect(style, `${paletteId}/${variant}`).toMatch(/--c-ink:\s*#[0-9A-F]{6}/);
      expect(style, `${paletteId}/${variant}`).toMatch(/--c-button-alt-border:\s*#[0-9A-F]{6}/);
    }
  });
});

/* ── the material system: the ground, and what it may not cost ──────────────────────── */

/**
 * THE CONTRAST GUARANTEE, RE-PROVEN AFTER THE PAINT.
 *
 * `tests/contract/template-palettes.test.ts` proves that each palette's ink clears 7:1 and its
 * secondary ink 4.5:1 **against the flat ground**. Three of the five surface styles then draw
 * something on top of that ground, underneath the text:
 *
 *   · `pattern` and `grain` lay ink-tinted marks on it, at `PATTERN_ALPHA` or less;
 *   · `mesh` lays radial blooms mixed from the palette's accent, secondary ink and rule
 *     colour — all three of which, on every palette in the set, sit on the SAME side of the
 *     ground as the ink does. They have to: they were each chosen to be legible on it. So
 *     every bloom spends contrast rather than adding it.
 *
 * That makes the contract's proof about a colour the reader no longer sees. This block proves
 * the same two thresholds about the colour they DO see, which is a different claim and the
 * one that matters. It is also why neither the motif alpha nor the bloom strength is a number
 * somebody chose: `card-ground.tsx` solves both down from what the design wants until these
 * assertions hold, so a palette added later cannot ship a treatment that quietly eats its
 * headroom — it gets a quieter treatment instead, automatically.
 *
 * The maths is duplicated here on purpose. `mixSrgb` is the module's own, but the thresholds
 * and the ratios are recomputed from `TEMPLATE_PALETTES` with `contrastRatio`, so this file
 * agrees with the treatment about the numbers only if the treatment is right.
 */
describe("no surface treatment spends the palette's contrast", () => {
  /** The claim, in one place: this composited ground still carries both levels of ink. */
  function expectLegible(palette: TemplatePalette, ground: string, why: string): void {
    expect(contrastRatio(palette.ink, ground), `${palette.id} · ${why} · primary ink`).toBeGreaterThanOrEqual(
      GROUND_PRIMARY_MIN,
    );
    expect(
      contrastRatio(palette.inkSoft, ground),
      `${palette.id} · ${why} · secondary ink`,
    ).toBeGreaterThanOrEqual(GROUND_SECONDARY_MIN);
  }

  /**
   * `color-mix(in srgb, …)` interpolates the GAMMA-ENCODED channels — CSS Color 4 calls the
   * linear space `srgb-linear`, and `srgb` is the encoded one. Getting that backwards would
   * make every number below disagree with what the browser actually paints, and it would
   * disagree in the safe direction on deep grounds and the unsafe one on light grounds, which
   * is the worst way for a bug like this to behave. Two fixed points pin it.
   */
  it("mixes colour the way the browser does", () => {
    expect(mixSrgb("#FFFFFF", "#000000", 0.5)).toBe("#808080");
    expect(mixSrgb("#FFFFFF", "#181A1F", 0.07)).toBe("#282A2F");
  });

  /**
   * ⚠ **The claim the whole texture rewrite rests on, asserted rather than trusted.**
   *
   * A mark drawn on the side of the ground AWAY from the ink cannot spend contrast — it moves
   * the composited ground further from the ink, so both ratios rise. That is why
   * `TEXTURE_PRESENCE` is an owner-facing control and not a solved ceiling, and if it is ever
   * false the presence dial is quietly shipping illegible cards. Checked at the loudest
   * presence, on every base every finish can paint, on every palette.
   */
  it.each(PALETTE_ORDER)("%s never loses contrast to a texture, at any presence", (id) => {
    const palette = TEMPLATE_PALETTES[id];
    const { away } = textureDirection(palette);

    for (const finish of FINISH_ORDER) {
      const bases =
        finish === "gradient"
          ? [palette.gradientFrom, palette.gradientTo]
          : finish === "mesh"
            ? [palette.ground, ...meshBloomHexes(palette)]
            : [palette.ground];

      for (const presence of TEXTURE_PRESENCE_ORDER) {
        const alpha = textureShadowAlpha(presence);

        for (const base of bases) {
          const marked = mixSrgb(away, base, alpha);

          /* Legible, and — the stronger claim — legible *by more* than the bare base was. */
          expectLegible(palette, marked, `${finish} · ${presence} shadow`);
          expect(
            contrastRatio(palette.ink, marked),
            `${id} · ${finish} · ${presence} · shadow must not cost primary ink`,
          ).toBeGreaterThanOrEqual(contrastRatio(palette.ink, base));
          expect(
            contrastRatio(palette.inkSoft, marked),
            `${id} · ${finish} · ${presence} · shadow must not cost secondary ink`,
          ).toBeGreaterThanOrEqual(contrastRatio(palette.inkSoft, base));
        }
      }
    }
  });

  /**
   * The ink-side counter-stroke is the one layer that still costs, so it is the one layer still
   * solved — against every base its finish can paint, not just the flat ground midpoint. It may
   * return 0 (a clean deboss with no highlight); it may never exceed the ceiling.
   */
  it.each(PALETTE_ORDER)("%s solves its texture edge under the ceiling", (id) => {
    const palette = TEMPLATE_PALETTES[id];
    const { toward } = textureDirection(palette);

    for (const finish of FINISH_ORDER) {
      const alpha = textureEdgeAlpha(palette, finish);
      expect(alpha, `${id} · ${finish}`).toBeLessThanOrEqual(TEXTURE_EDGE_ALPHA);
      expect(alpha, `${id} · ${finish}`).toBeGreaterThanOrEqual(0);

      const bases =
        finish === "gradient"
          ? [palette.gradientFrom, palette.gradientTo]
          : finish === "mesh"
            ? [palette.ground, ...meshBloomHexes(palette)]
            : [palette.ground];

      for (const base of bases) {
        expectLegible(palette, mixSrgb(toward, base, alpha), `${finish} edge at ${alpha}`);
      }
    }
  });

  /**
   * ⚠ The regression this rewrite exists to prevent, stated as a number.
   *
   * The old ink-side motif solved to 0.060 on Onyx, and six percent white on `#181A1F` is what
   * "all the wallpapers look the same" actually meant. Nothing may quietly put the texture back
   * on the ink side or ration it down there again.
   */
  it.each(PALETTE_ORDER)("%s draws its texture strongly enough to see", (id) => {
    const palette = TEMPLATE_PALETTES[id];
    expect(textureShadowAlpha("subtle"), id).toBeGreaterThan(0.2);
    expect(textureShadowAlpha("strong"), id).toBeGreaterThan(textureShadowAlpha("medium"));
    expect(textureShadowAlpha("medium"), id).toBeGreaterThan(textureShadowAlpha("subtle"));
  });

  it.each(PALETTE_ORDER)("%s keeps every mesh bloom, and every overlap, legible", (id) => {
    const palette = TEMPLATE_PALETTES[id];
    const pcts = meshBloomPercents(palette);
    const blooms = meshBloomHexes(palette);

    expect(pcts).toHaveLength(MESH_BLOOMS.length);

    pcts.forEach((pct, i) => {
      /* Never louder than the design asked for, and never zero — a mesh that solved to nothing
         would render as `flat` while claiming to be `mesh`. */
      expect(pct, `${id} bloom ${i}`).toBeLessThanOrEqual(MESH_BLOOMS[i].want);
      expect(pct, `${id} bloom ${i}`).toBeGreaterThan(0);
      expectLegible(palette, blooms[i], `bloom ${i} (${MESH_BLOOMS[i].key})`);
    });

    /* ⚠ The blooms overlap, and three individually safe colours can composite into a fourth
       that is not. Overlapping radials produce a convex combination of their peak colours and
       the ground, and relative luminance is monotone in every channel — so the worst pixel the
       whole mesh can produce is bounded by the channel-wise minimum and maximum of the set.
       Those two synthetic colours are what turn "each bloom is safe" into "the mesh is safe". */
    const set = [palette.ground, ...blooms].map((hex) =>
      [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
    );
    const corner = (pick: (values: number[]) => number): string =>
      `#${[0, 1, 2]
        .map((i) => pick(set.map((c) => c[i])).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`;

    expectLegible(palette, corner((v) => Math.min(...v)), "darkest overlap");
    expectLegible(palette, corner((v) => Math.max(...v)), "lightest overlap");
  });
});

/**
 * The ground is one element, it is out of flow, and it makes no requests.
 *
 * "No raster assets and no network" is a product commitment (§"This build makes zero outbound
 * requests"), and a wallpaper is exactly the kind of thing that acquires a CDN URL during a
 * redesign. Every mark the ground paints is authored SVG inlined as a `data:` URI, so the
 * assertion is simply that nothing in the card's markup names a remote scheme.
 */
describe("the painted ground", () => {
  /* Both axes, every value, because the defect this block now guards was precisely that two
     axes had been folded into one and three of its five values rendered identically. */

  /**
   * A card carrying a chosen material surface.
   *
   * `ResolvedCard.surface` is now a **concrete** `ResolvedSurface` — `resolveCard` applies the
   * defaults and the legacy `pageHeader` fallback, so every renderer reads three real values.
   * This helper used to spread a *partial* `CardSurface` straight in, which was correct while the
   * renderer resolved the axes itself; against the wired resolver it left `patternId` and
   * `headerLayout` undefined. Merging through `resolveCardSurface` keeps the test expressing one
   * axis while handing the renderer what it now guarantees it receives.
   */
  function withSurface(resolved: ResolvedCard, surface: CardSurface): ResolvedCard {
    return { ...resolved, surface: { ...resolveCardSurface(surface) } };
  }

  it.each(FINISH_ORDER)("renders exactly one ground for %s", (finish) => {
    const resolved = withSurface(resolveFixture(RICHEST.id), { finish });
    const { container } = render(<CardPage resolved={resolved} />);

    const grounds = container.querySelectorAll("[data-card-ground]");
    expect(grounds).toHaveLength(1);
    expect(grounds[0].getAttribute("data-card-finish")).toBe(finish);
    /* Decorative by definition: it carries no text, so it must carry no accessible presence
       either — a screen reader announcing "group" before the owner's name is noise. */
    expect(grounds[0].getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("[data-card-root]")?.getAttribute("data-finish")).toBe(finish);
  });

  /**
   * ⚠ The two axes are independent, and this is where that is proved rather than asserted in
   * prose: **every** texture paints over **every** finish. The old renderer refused a motif on
   * anything but `flat`, which is half of why five wallpapers looked like two.
   */
  it("paints a texture on every finish, and nothing at all for `none`", () => {
    for (const finish of FINISH_ORDER) {
      for (const texture of TEXTURE_ORDER) {
        const resolved = withSurface(resolveFixture(RICHEST.id), { finish, texture });
        const { container } = render(<CardPage resolved={resolved} />);
        const layers = container.querySelectorAll<HTMLElement>("[data-card-ground-motif]");
        const why = `${finish}/${texture}`;

        if (texture === "none") {
          expect(layers, why).toHaveLength(0);
          continue;
        }

        /* The mark itself, always. `grain` gets no counter-stroke — offsetting noise by 1px
           produces more noise, not relief — so one layer there and two everywhere else. */
        expect(layers.length, why).toBeGreaterThanOrEqual(1);
        expect(layers[0].dataset.cardGroundMotifRole, why).toBe("shadow");
        expect(Number(layers[0].style.opacity), why).toBeGreaterThan(0.2);

        /* ⚠ The edge is present exactly when the solver found room for it, and NOT always.
           `mesh` spends the palette's headroom on its blooms, so on some palettes
           `textureEdgeAlpha` correctly returns 0 and the texture renders as a clean deboss with
           no highlight. Asserting "always two layers" would have been asserting that the solver
           never does its job. */
        const edge = textureEdgeAlpha(resolved.palette, finish);

        if (texture === "grain" || edge === 0) {
          expect(layers, why).toHaveLength(1);
        } else {
          expect(layers, why).toHaveLength(2);
          expect(layers[1].dataset.cardGroundMotifRole, why).toBe("edge");
          /* Still solved, still under the ceiling — the one layer that costs contrast. */
          expect(Number(layers[1].style.opacity), why).toBeCloseTo(edge, 5);
          expect(Number(layers[1].style.opacity), why).toBeLessThanOrEqual(TEXTURE_EDGE_ALPHA);
          /* Offset is what makes the pair read as a groove rather than a doubled line. */
          expect(layers[1].style.backgroundPosition, why).toBe("1px 1px");
        }
      }
    }
  });

  it.each(TEXTURE_ORDER.filter((t) => t !== "none"))("scales %s off its authored tile", (texture) => {
    for (const textureScale of ["fine", "regular", "large"] as const) {
      const resolved = withSurface(resolveFixture(RICHEST.id), { texture, textureScale });
      const { container } = render(<CardPage resolved={resolved} />);
      const motif = container.querySelector<HTMLElement>("[data-card-ground-motif]");

      expect(motif?.getAttribute("data-card-ground-motif")).toBe(texture);
      /* The tile is `TEXTURES[id].tile` times the scale and never a number typed in twice: a
         motif authored on a 32px grid and tiled at 24 is a pattern with a seam every tile. */
      const painted = Math.round((TEXTURES[texture].tile as number) * TEXTURE_SCALE[textureScale]);
      expect(motif?.style.backgroundSize, `${texture}/${textureScale}`).toBe(
        `${painted}px ${painted}px`,
      );
    }
  });

  it("makes no outbound request, on any finish or texture", () => {
    for (const finish of FINISH_ORDER) {
      for (const texture of TEXTURE_ORDER) {
        const resolved = withSurface(resolveFixture(RICHEST.id), { finish, texture });
        /* The GROUND's markup, not the card's: the owner's portrait is a real `/public`
           image and is supposed to be one. What may never appear is a remote asset behind
           the card, which is the thing a "wallpaper" acquires during a redesign. */
        const ground = render(<CardPage resolved={resolved} />).container.querySelector(
          "[data-card-ground]",
        ) as HTMLElement;
        const html = ground.outerHTML;
        /* `//` catches protocol-relative URLs too, which is the form that survives a
           copy-paste from a CDN dashboard. The only legitimate `url(` here is a `data:` URI. */
        expect(html, `${finish}/${texture}`).not.toMatch(/(https?:)?\/\//);
        expect(html, `${finish}/${texture}`).not.toMatch(
          /\.(png|jpe?g|webp|gif|avif)\b/i,
        );
      }
    }
  });

  /**
   * ⚠ The regression this whole file exists for, restated for the ground.
   *
   * The fix for the old build's clipped field list is the ABSENCE of `overflow` and of a
   * height on the card page. A full-bleed painted layer is the most plausible thing anyone
   * would ever add one for — "the ground needs to be clipped to the card" is a sentence that
   * sounds reasonable and would reintroduce the defect. It does not need to be clipped: it is
   * out of flow with `inset: 0`, so it has no effect on the card's scroll area at all.
   */
  it("adds no scroll container and no height, on any style", () => {
    for (const finish of FINISH_ORDER) {
      const resolved = withSurface(resolveFixture(RICHEST.id), { finish });
      const { container } = render(<CardPage resolved={resolved} />);
      const root = container.querySelector('[data-card-variant="page"]') as HTMLElement;

      expect(root.getAttribute("style"), finish).not.toMatch(/(^|;)\s*height\s*:/);
      const scrollers = [...root.querySelectorAll<HTMLElement>("*")].filter((el) =>
        /overflow(-[xy])?\s*:\s*(auto|scroll)/.test(el.getAttribute("style") ?? ""),
      );
      expect(scrollers.map((el) => el.tagName), finish).toEqual([]);
    }
  });
});

/**
 * ⚠ **Layout changes composition. It never changes what the card shares.**
 *
 * `HEADER_LAYOUTS` states that as a rule and `IdentityBlock` is where it is kept or broken —
 * the branch there is four arrangements of the same four elements. The failure mode it guards
 * against is not cosmetic: a layout that dropped the bio, or that rendered one fewer row
 * because it ran out of room, would be a card lying to its owner about what a recipient gets.
 *
 * So every layout is asserted to produce the SAME field set, in the SAME order, with the SAME
 * classification, and to keep all four parts of the identity block.
 */
/**
 * ⚠ **"every header layout shares exactly the same card" stood here, and the axis it guarded is
 * gone.** It asserted that `classic | banner | hero | minimal` rendered identical rows in
 * identical order, that each kept the whole identity block, and that only `minimal` went
 * unpainted. With one composition there is nothing left to hold equal — and the rows/order
 * claims it made are already covered, per-card and per-fixture, by `cardPageRows` above.
 */

