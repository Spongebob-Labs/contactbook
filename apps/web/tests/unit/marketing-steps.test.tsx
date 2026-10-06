import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen, within } from "../helpers/render";
import { brandCardContent } from "@/components/marketing/brand-card-content";
import { Close } from "@/components/marketing/close";
import { CARD_DESIGN_W, CARD_WINDOW_H, HowItWorks } from "@/components/marketing/how-it-works";
import { PASS_ALT_TEXT } from "@/components/marketing/wallet-pass";
import {
  close,
  exampleCardSpecs,
  howItWorks,
  mayaProfile,
  waitlistPage,
} from "@/fixtures/marketing";
import { MAYA_CITIES } from "@/fixtures/marketing-identity";
import { formatPhoneDisplay, toE164 } from "@/lib/format";

/**
 * `how-it-works.tsx` + `close.tsx` — the two sections built together for
 * `docs/landing-integration.md`'s Agent C pass, and the CSS partial they share
 * (`marketing-steps.css`).
 *
 * ⚠ happy-dom has no layout engine and no compiled Tailwind sheet (see `tests/helpers/
 * render.tsx`'s own header): nothing here asserts geometry or a computed colour. The rail's
 * reflow is asserted from the CSS source instead — and the breakpoint is DERIVED from the
 * layout's own widths rather than named, because naming it is exactly how a 79px overflow
 * shipped green — the rendered result at 1440/375, in
 * both skins, is verified separately with a real browser. Structure and content are asserted
 * from the DOM; the lead pipeline is asserted end to end against a stubbed `fetch`, the same
 * pattern `tests/unit/public-card.test.ts` already uses for its own HTTP outcomes.
 */

const SRC = resolve(__dirname, "../../src");
function source(relative: string): string {
  return readFileSync(resolve(SRC, relative), "utf8");
}

/**
 * ⚠ STRIP COMMENTS BEFORE ANY SOURCE SCAN, AND IT IS NOT HYGIENE — IT IS CORRECTNESS.
 * This codebase documents its own history in prose, so `how-it-works.tsx`'s header QUOTES the
 * `scale={0.24}` it replaced and `marketing-steps.css`'s comments describe the `width: 100vw`
 * and the `position: sticky` that are deliberately absent. A raw scan finds every one of those
 * in the documentation of their own removal and fails for the opposite of the right reason.
 * (`marketing-hero.test.tsx` has the same trap live in it, where it makes a real assertion
 * vacuous.)
 */
function code(relative: string): string {
  return source(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

const OWNED = [
  "components/marketing/how-it-works.tsx",
  "components/marketing/world-map.tsx",
  "components/marketing/world-globe.tsx",
  "components/marketing/globe-geometry.ts",
  "components/marketing/globe-land.ts",
  "components/marketing/close.tsx",
  "styles/marketing-steps.css",
] as const;

/** How the section prints a voice number. Maya's four must come out of the product's formatter
 *  exactly as the identity file writes them — London `+44 20 …` and the 8-digit UAE line were
 *  added to `format.ts` so no section needs its own override. */
function expectedVoice(value: string): string {
  return (
    MAYA_CITIES.find((city) => toE164(city.phone) === toE164(value))?.phone ??
    formatPhoneDisplay(value)
  );
}

/**
 * ⚠ REWRITTEN 2026-10-06 WITH THE SECTION'S SIXTH BUILD — FOUR STEPS IN ONE ROW.
 *
 * The client replaced the five steps with four (`howItWorks.steps`, verbatim) and rejected the
 * first four-step build as *"very big, a lot of dirt in the UI"*: step 04 wrapped onto its own
 * row, frame 01 was taller than the others, frame 02 was a stack of three overlapping cards, and
 * frame 03 showed the in-app card instead of the Apple Wallet pass the product actually issues.
 *
 * The suite this replaces asserted three steps in the rail with two "properties" under a
 * hairline, a three-card deck, a `ShareFace` in every card frame and a three-column breakpoint.
 * Every one of those premises is gone on the client's word, so each test below is the
 * equivalent guard for what exists now, at the same strength: exact counts, exact order, the
 * same object in every frame, and the breakpoint re-derived from the frame's contents.
 *
 * happy-dom has no layout engine, so the row and the frame sizes are asserted from the CSS
 * source (below) and measured in a real browser separately; what is pinned here is the
 * construction that produces them.
 */
describe("HowItWorks — the four-step rail", () => {
  const STEP_COUNT = 4;

  it("puts all four of the client's steps in the rail, in order, and nothing under it", () => {
    const { container } = renderWithProviders(<HowItWorks />);

    expect(howItWorks.steps).toHaveLength(STEP_COUNT);
    expect(container.querySelectorAll(".mk-steps-rail")).toHaveLength(1);
    const items = [...container.querySelectorAll(".mk-steps-rail > .mk-steps-item")];
    expect(items).toHaveLength(STEP_COUNT);
    expect(container.querySelectorAll(".mk-steps-marker")).toHaveLength(STEP_COUNT);

    /* ⚠ NOT ONE WORD OF THE CLIENT'S COPY IS DROPPED, AND EACH STEP STAYS IN ITS OWN COLUMN. */
    howItWorks.steps.forEach((step, i) => {
      const heading = screen.getByRole("heading", { level: 3, name: step.title });
      expect(heading.closest("li")).toBe(items[i]);
      expect(within(items[i] as HTMLElement).getByText(step.body)).toBeInTheDocument();
    });

    // The old "two properties under a hairline" are gone; 04 is a numbered step with a frame.
    expect(container.querySelectorAll(".mk-steps-after, .mk-steps-after__item")).toHaveLength(0);
  });

  it("prints every step's ordinal inside its marker, 01 to 04", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const printed = [...container.querySelectorAll(".mk-steps-marker__n")].map((n) =>
      n.textContent?.trim(),
    );
    expect(printed).toEqual(["01", "02", "03", "04"]);
    expect(printed).toEqual(howItWorks.steps.map((s) => s.ordinal));
  });

  it("draws one rule through the markers, with no end hanging off either outer edge", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    /* Each interior boundary draws two halves — the step before it draws "after", the step
       after it draws "before" — and the two outer ends draw none. */
    expect(container.querySelectorAll("[data-edge]")).toHaveLength(2 * (STEP_COUNT - 1));
    const items = [...container.querySelectorAll(".mk-steps-item")];
    expect(items[0]!.querySelector('[data-edge="before"]')).toBeNull();
    expect(items[STEP_COUNT - 1]!.querySelector('[data-edge="after"]')).toBeNull();
  });

  it("sets every step's words above its frame — disc, title, body, frame, in that order", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    for (const item of container.querySelectorAll(".mk-steps-item")) {
      const order = [...item.children].map((child) =>
        ["mk-steps-track", "mk-steps-title", "mk-steps-body", "mk-steps-frame"].find((c) =>
          child.classList.contains(c),
        ),
      );
      // Exactly four children, so the four subgrid rows line up across the row.
      expect(order).toEqual(["mk-steps-track", "mk-steps-title", "mk-steps-body", "mk-steps-frame"]);
    }
  });

  /**
   * ⚠ REPLACED "two real palettes" (2026-10-06). That guarded step 02's old copy — "give it a
   * colour" — by requiring two palettes in its frame. The copy is now "Choose which fields go
   * on the card and then design it", so the claim to prove is the choice: the card in frame 02
   * carries a real subset of the profile, row for row, not the whole thing.
   */
  it("shows the design step as a designed card carrying a chosen subset of the profile", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const card = container.querySelector("[data-steps-card] .mk-hc__card");
    expect(card, "frame 02 should hold the brand card").not.toBeNull();

    const work = exampleCardSpecs.find((c) => c.id === "work")!.card;
    const content = brandCardContent("work");
    const rows = [...card!.querySelectorAll(".mk-hc__row .mk-hc__value")].map((n) => n.textContent);
    expect(rows).toEqual(content.sections.flatMap((s) => s.rows.map((r) => r.value)));
    expect(rows.length).toBeGreaterThan(0);
    expect(work.fieldIds.length, "the card must carry fewer fields than the profile").toBeLessThan(
      mayaProfile.fields.length,
    );
  });

  it("rides the one closed reveal vocabulary — never a third `data-mk-reveal-move`", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const moves = new Set(
      [...container.querySelectorAll("[data-mk-reveal-move]")].map((n) =>
        n.getAttribute("data-mk-reveal-move"),
      ),
    );
    expect(moves.size).toBeGreaterThan(0);
    for (const move of moves) {
      expect(["rise", "deal"]).toContain(move);
    }
  });
});

describe("HowItWorks — four identical frames, one object in each", () => {
  /**
   * ⚠ SIXTH BUILD, 2026-10-06. The fifth build's frames were identical in class but not in
   * content: frame 02 dealt a deck of three cards, and its back cards showed as black and peach
   * slivers clipped by the frame — the "dirt". What is pinned now is one window per frame and
   * one object per window, and the same card running through 02, 03 and 04.
   */
  it("gives every step the identical frame — one class, one label, one window", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const frames = [...container.querySelectorAll(".mk-steps-frame")];
    expect(frames).toHaveLength(4);
    const labels = [howItWorks.panels.profile, howItWorks.panels.card, howItWorks.panels.pass, howItWorks.panels.update];
    frames.forEach((frame, i) => {
      // One class, so one size, one hairline, one ground. A per-step variant is how rows go ragged.
      expect(frame.className.trim()).toBe("mk-steps-frame");
      expect(frame).toHaveAttribute("aria-hidden", "true");
      expect(frame.querySelectorAll(".mk-steps-frame__label")).toHaveLength(1);
      expect(frame.querySelector(".mk-steps-frame__label")!.textContent).toBe(labels[i]);
      expect(frame.querySelectorAll(".mk-steps-window")).toHaveLength(1);
    });
  });

  it("puts exactly one card or pass in each card frame — no deck, no stack, no fan", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    expect(container.querySelector(".mk-steps-deck, .mk-steps-deck__card")).toBeNull();

    // 02 is the designer's view (one object: the designer, holding one card); 04 is one card plus
    // the banner that says an update arrived. Neither holds a second card or a pass.
    const designer = container.querySelector("[data-steps-card]")!;
    expect(designer.querySelectorAll(".mk-hc__card"), "02 must hold one card").toHaveLength(1);
    expect(designer.querySelectorAll("[data-wallet-pass]")).toHaveLength(0);
    expect(designer.querySelector(".mk-steps-window")!.children).toHaveLength(1);
    expect(designer.querySelector(".mk-steps-window")!.firstElementChild).toHaveAttribute("data-steps-designer");

    const update = container.querySelector("[data-steps-update]")!;
    expect(update.querySelectorAll(".mk-hc__card"), "04 must hold one card").toHaveLength(1);
    expect(update.querySelectorAll("[data-wallet-pass]")).toHaveLength(0);
    expect(update.querySelectorAll(".mk-steps-window > .mk-steps-toast")).toHaveLength(1);
    expect(update.querySelector(".mk-steps-window")!.children).toHaveLength(2);

    const pass = container.querySelector("[data-steps-pass]")!;
    expect(pass.querySelectorAll("[data-wallet-pass]"), "frame 03 must hold the wallet pass").toHaveLength(1);
    expect(pass.querySelectorAll(".mk-hc__card"), "frame 03 is the pass, not the in-app card").toHaveLength(0);
    expect(pass.querySelector(".mk-steps-window")!.children).toHaveLength(1);

    // Four frames, four objects, and nothing else that draws a card anywhere in the rail.
    expect(container.querySelectorAll(".mk-steps-rail .mk-hc__card")).toHaveLength(2);
    expect(container.querySelectorAll(".mk-steps-rail [data-wallet-pass]")).toHaveLength(1);
  });

  it("makes frame 02 a designer's view and frame 04 an arrival — two different pictures", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const designer = container.querySelector("[data-steps-designer]")!;

    // "Make as many cards as you want": the three example cards as tabs, Work active, and a "+".
    const tabs = [...designer.querySelectorAll(".mk-steps-tab")];
    expect(tabs.map((t) => t.textContent)).toEqual(["Work", "Family", "CV", "+"]);
    expect(designer.querySelectorAll(".mk-steps-tab[data-active]")).toHaveLength(1);
    expect(designer.querySelector(".mk-steps-tab[data-active]")!.textContent).toBe("Work");

    // "Design it": the palettes on offer with exactly one chosen, and the card wears a tint.
    expect(designer.querySelectorAll(".mk-steps-swatch")).toHaveLength(4);
    expect(designer.querySelectorAll(".mk-steps-swatch[data-active]")).toHaveLength(1);
    expect(designer.querySelectorAll(".mk-hc__tint")).toHaveLength(1);

    // "Choose which fields go on the card": four chips, two on and two off, the on ones being the
    // fields the Work card carries.
    const chips = [...designer.querySelectorAll(".mk-steps-fchip")];
    expect(chips).toHaveLength(4);
    expect(chips.filter((c) => c.hasAttribute("data-on")).map((c) => c.textContent)).toEqual([
      "Mobile",
      "Work email",
    ]);
    // All drawn: nothing in the designer can be focused or typed into.
    expect(designer.querySelectorAll("input, button, a, select, textarea, [tabindex]")).toHaveLength(0);

    // 04 is not 02: no designer furniture, the update banner instead, one row marked Updated.
    const update = container.querySelector("[data-steps-update]")!;
    expect(update.querySelector("[data-steps-designer], .mk-steps-tab, .mk-steps-swatch, .mk-steps-fchip")).toBeNull();
    expect(update.querySelector(".mk-steps-toast")!.textContent).toBe("Maya updated her card");
    expect(update.querySelectorAll(".mk-hc__row[data-updated]")).toHaveLength(1);
    expect(designer.querySelectorAll(".mk-hc__row[data-updated]")).toHaveLength(0);
    expect(update.querySelector(".mk-hc__tint")).toBeNull();
  });

  it("builds every card frame from the brand card and the wallet pass — never the product's face", () => {
    const src = code("components/marketing/how-it-works.tsx");
    expect(src).toContain("<BrandCard");
    expect(src).toContain("<WalletPass");
    expect(src).not.toContain("ShareFace");
    expect(src).not.toContain("CardPageThumb");
    expect(src).not.toMatch(/\bCardPage\b/);
    // No authored linework, no glyph standing in for a verb.
    expect(src).not.toMatch(/function\s+\w*(Diagram|Annotation)\s*\(/);
    expect(src).not.toContain("<path");
    // The card's size comes from the stylesheet's one zoom, never a per-frame inline value.
    expect(src).not.toMatch(/zoom\s*:/);
  });

  it("runs the same card through frames 02, 03 and 04 — built, handed over, updated", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const built = container.querySelector("[data-steps-card] [data-card-id]");
    const pass = container.querySelector("[data-steps-pass] [data-wallet-pass]");
    const updated = container.querySelector("[data-steps-update] [data-card-id]");
    for (const [name, node] of [["built", built], ["pass", pass], ["updated", updated]] as const) {
      expect(node, `no ${name} object`).not.toBeNull();
      expect(node!.getAttribute("data-card-id"), name).toBe("work");
    }
    // The pass's barcode is that card's own public link.
    const work = exampleCardSpecs.find((c) => c.id === "work")!.card;
    expect(pass!.querySelector("[data-pass-barcode]")).toHaveAttribute("data-qr-payload", work.publicUrl!);
    // And the same person on both.
    expect(built!.querySelector(".mk-hc__name")!.textContent).toBe(
      pass!.querySelector('[data-pass-field="primary"] .mk-pass__value')!.textContent,
    );
  });

  it("marks exactly one changed field in frame 04, and none in frame 02", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const marked = [...container.querySelectorAll("[data-steps-update] .mk-hc__row[data-updated]")];
    expect(marked).toHaveLength(1);
    expect(marked[0]!.querySelector(".mk-hc__value")!.textContent).toBe(howItWorks.update.value);
    expect(marked[0]!.querySelector(".mk-hc__updated")!.textContent).toBe(howItWorks.update.mark);
    expect(container.querySelectorAll("[data-steps-card] .mk-hc__row[data-updated]")).toHaveLength(0);

    // The two cards are otherwise the same rows: one field changed, nothing else.
    const rowsOf = (hook: string) =>
      [...container.querySelectorAll(`${hook} .mk-hc__value`)].map((n) => n.textContent);
    const before = rowsOf("[data-steps-card]");
    const after = rowsOf("[data-steps-update]");
    expect(after).toHaveLength(before.length);
    expect(after.filter((value, i) => value !== before[i])).toEqual([howItWorks.update.value]);
  });

  /** 2026-09-28: the records are Maya's (`mayaProfile`), not the app fixture user's. */
  it("draws the profile from Maya's real records, numbers formatted as they are written", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const panel = container.querySelector("[data-steps-profile]");
    expect(panel, "expected the profile frame body").not.toBeNull();

    const rows = [...panel!.querySelectorAll(".mk-steps-profile__row")];
    // 2026-10-06: six rows, so frame 01 is the same height as the card frames (client: "make
    // all four frames one identical height … shorten panel 01's list to fit").
    expect(rows).toHaveLength(6);
    expect(panel!.querySelector(".mk-steps-profile__more")).not.toBeNull();

    rows.forEach((row, i) => {
      // The stagger index the stylesheet reads.
      expect(row.getAttribute("style")).toContain(`--mk-steps-row-i: ${i}`);
      // A drawn icon in every disc — never an empty circle.
      expect(row.querySelector(".mk-steps-profile__disc svg"), `row ${i} has an empty disc`).not.toBeNull();

      const label = row.querySelector(".mk-steps-profile__name")?.textContent?.trim();
      const value = row.querySelector(".mk-steps-profile__value")?.textContent?.trim();
      const match = mayaProfile.fields.find((f) => f.label === label);
      expect(match, `"${label}" is not a field in mayaProfile`).toBeTruthy();
      const voice = match!.type === "PHONE" || match!.type === "LANDLINE";
      expect(value).toBe(voice ? expectedVoice(match!.value) : match!.value);
    });
  });

  /**
   * The survey's actual diagnosis, made testable: the profile must list the fields the card
   * beside it carries, plus at least one it does not — so a reader can match values row for
   * row AND see the filter working. If the work card's `fieldIds` drift, this fails.
   */
  it("lists the fields the card actually carries, plus one it leaves off", () => {
    renderWithProviders(<HowItWorks />);
    const work = exampleCardSpecs.find((c) => c.id === "work")!.card;
    const onCard = new Set<string>(work.fieldIds);
    const listed = [...document.querySelectorAll("[data-steps-profile] .mk-steps-profile__name")]
      .map((n) => n.textContent?.trim())
      .map((label) => mayaProfile.fields.find((f) => f.label === label)?.id)
      .filter((id): id is string => Boolean(id));

    const shared = listed.filter((id) => onCard.has(id));
    const excluded = listed.filter((id) => !onCard.has(id));
    expect(shared.length, "the profile should visibly feed the card").toBeGreaterThanOrEqual(4);
    expect(excluded.length, "one row should visibly NOT make it onto the card").toBeGreaterThanOrEqual(1);
  });
});

/**
 * Frame 03, 2026-10-06. The client: *"this is not the actual card that we are making for the
 * Apple Wallet … no disparity."* The pass is drawn from `apps/api/src/wallet/pass-builder.ts`'s
 * own rules, and these tests pin those rules against the same fixture, so the drawing cannot
 * quietly say something the real pass would not.
 */
describe("HowItWorks — frame 03 is the Apple Wallet pass the API signs", () => {
  it("says exactly what `selectPassContent` / `buildPassJson` put on the pass", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const pass = container.querySelector("[data-steps-pass] [data-wallet-pass]")!;
    expect(pass).toHaveAttribute("data-pass-style", "eventTicket");
    expect(pass).toHaveAttribute("data-palette-id", "sapphire");

    const fieldValue = (id: string) => mayaProfile.fields.find((f) => f.id === id)!.value;
    // logoText = the card's COMPANY value, upper-cased.
    expect(pass.querySelector(".mk-pass__logo-text")!.textContent).toBe(fieldValue("field_company").toUpperCase());
    // Primary field: label = JOB_TITLE, value = the owner's name.
    const primary = pass.querySelector('[data-pass-field="primary"]')!;
    expect(primary.querySelector(".mk-pass__label")!.textContent).toBe(fieldValue("field_job_title"));
    expect(primary.querySelector(".mk-pass__value")!.textContent).toBe("Maya Laurent");
    // Two details, a PHONE before an EMAIL, each with its own label and its value AS STORED.
    const detail = (slot: string) => {
      const node = pass.querySelector(`[data-pass-field="${slot}"]`)!;
      return [node.querySelector(".mk-pass__label")!.textContent, node.querySelector(".mk-pass__value")!.textContent];
    };
    expect(detail("secondary")).toEqual(["Mobile", fieldValue("field_mobile")]);
    expect(detail("auxiliary")).toEqual(["Work email", fieldValue("field_work_email")]);
    // The barcode's alt text, verbatim from the builder.
    expect(pass.querySelector(".mk-pass__alt")!.textContent).toBe(PASS_ALT_TEXT);
    expect(PASS_ALT_TEXT).toBe("Scan to open card");
  });

  it("matches the builder's own source, so a change there is a change here", () => {
    const builder = readFileSync(resolve(__dirname, "../../../api/src/wallet/pass-builder.ts"), "utf8");
    expect(builder).toMatch(/altText:\s*'Scan to open card'/);
    expect(builder).toMatch(/const DETAIL_PREFERENCE = \['PHONE', 'EMAIL', 'URL'\]/);
    expect(builder).toMatch(/const MAX_DETAIL_PAIRS = 2;/);
    expect(builder).toMatch(/eventTicket:\s*\{/);
    expect(builder).toMatch(/logoText:\s*\(company \?\? config\.orgName\)\.toUpperCase\(\)/);

    // The colours are the API's sapphire palette and its logo gold, byte for byte.
    const colors = readFileSync(resolve(__dirname, "../../../api/src/wallet/pass-colors.util.ts"), "utf8");
    const sapphire = /sapphire:\s*\{([^}]*)\}/.exec(colors)![1]!;
    const hex = (key: string) => new RegExp(`${key}:\\s*'(#[0-9A-Fa-f]{6})'`).exec(sapphire)![1]!.toLowerCase();
    const tokens = source("styles/marketing.css");
    const token = (name: string) => new RegExp(`--mk-pass-${name}:\\s*(#[0-9a-f]{6})`).exec(tokens)![1];
    expect(token("sapphire-from")).toBe(hex("from"));
    expect(token("sapphire-to")).toBe(hex("to"));
    expect(token("sapphire-ink")).toBe(hex("ink"));
    expect(token("sapphire-label")).toBe(hex("inkSoft"));
    const images = readFileSync(resolve(__dirname, "../../../api/src/wallet/pass-images.ts"), "utf8");
    expect(token("gold")).toBe(/BRAND_GOLD = '(#[0-9A-Fa-f]{6})'/.exec(images)![1]!.toLowerCase());
  });

  it("carries no address, no link text and nothing the card does not share", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const pass = container.querySelector("[data-steps-pass] [data-wallet-pass]")!;
    const text = pass.textContent ?? "";
    expect(text).not.toContain("card.example");
    expect(text).not.toMatch(/Wren Yard|Lisbon/);
    const work = exampleCardSpecs.find((c) => c.id === "work")!.card;
    for (const field of mayaProfile.fields) {
      if (work.fieldIds.includes(field.id)) continue;
      expect(text, `${field.label} is not on the work card`).not.toContain(field.value);
    }
  });
});

/**
 * The client, 2026-09-28: *"'How it works' section: replace Indian numbers with London, Dubai,
 * New York, Singapore addresses and numbers. Consider adding a global map element to
 * reinforce international feel."*
 */
describe("HowItWorks — Maya's four cities, and the map", () => {
  it("carries no Indian number or Mumbai detail anywhere in the section", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\+91|Mumbai|Maharashtra|India\b/);
  });

  /* ⚠ CHANGED 2026-10-06. This required all four cities' numbers in frame 01 as well as on the
     map. The client then asked for frame 01 to be shortened to the card frames' height ("fewer
     rows, e.g. five plus + anything custom"), and four office rows alone would fill it. So frame 01 keeps Maya's own base, London, with its number exactly as the identity writes it. */
  it("keeps Maya's London base in the profile, and the globe band as its own decorative picture beside one statement", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const profile = container.querySelector("[data-steps-profile]")!.textContent ?? "";
    const london = MAYA_CITIES.find((city) => city.city === "London");
    expect(london, "the identity file should carry London").toBeTruthy();
    expect(profile, "London's number is not in the profile").toContain(london!.phone);

    const map = container.querySelector("[data-steps-map]");
    expect(map, "no map band").not.toBeNull();
    /* ⚠ CHANGED 2026-10-07. The band used to carry a list of Maya's four cities with their numbers,
       and this asserted it. The client removed that list ("remove the details on the right") and the
       band now carries one statement beside the globe. What must hold: the picture is hidden from
       assistive tech (it is decorative), the statement is not, and the city list is really gone. */
    expect(map!.querySelector(".mk-globe__stage")).toHaveAttribute("aria-hidden", "true");
    const statement = map!.querySelector(".mk-map__statement")!;
    expect(statement.closest("[aria-hidden]")).toBeNull();
    expect(statement.textContent).toContain(howItWorks.map.statement.lead);
    expect(statement.textContent).toContain(howItWorks.map.statement.punchline);
    expect(map!.querySelector(".mk-map__legend, .mk-map__place, .mk-map__pin")).toBeNull();
    expect(map!.textContent).not.toContain(london!.address);
  });

  /* Still true of the globe: its server-rendered still places each pin by percentage inside the
     still's own square frame, the way the flat map placed them inside its box. */
  /**
   * ⚠ REWRITTEN 2026-09-29. This pinned "a static inline SVG" — true of the flat map, and no longer
   * the design: the globe turns, so it is a client island. What it guarded is unchanged and is
   * restated against the new files: the band's own file stays a server component, nothing links a
   * map or 3D library (cobe, three, d3 and globe.gl were references, rebuilt here, never installed),
   * nothing is fetched, and the land data stays small.
   */
  it("is a server band around a small client island, with no map library and no outbound request", () => {
    const band = source("components/marketing/world-map.tsx");
    expect(band).not.toMatch(/^\s*["']use client["'];?\s*$/m);
    expect(source("components/marketing/world-globe.tsx")).toMatch(/^["']use client["'];/);

    for (const file of [
      "components/marketing/world-map.tsx",
      "components/marketing/world-globe.tsx",
      "components/marketing/globe-geometry.ts",
      "components/marketing/globe-land.ts",
    ]) {
      const raw = source(file);
      expect(raw, file).not.toMatch(
        /from "(?:dotted-map|cobe|three|globe\.gl|react-globe\.gl|d3[\w-]*|leaflet|mapbox[\w-]*|topojson[\w-]*)"/,
      );
      expect(code(file), file).not.toMatch(/https?:\/\//);
      expect(Buffer.byteLength(raw, "utf8"), file).toBeLessThan(40_000);
    }

    const pkg = readFileSync(resolve(__dirname, "../../package.json"), "utf8");
    for (const dep of ["dotted-map", "cobe", "\"three\"", "globe.gl"]) {
      expect(pkg, `${dep} is a reference, never a dependency`).not.toContain(dep);
    }
  });
});

describe("HowItWorks — the CSS contracts", () => {
  const css = code("styles/marketing-steps.css");

  /**
   * ⚠ RE-DERIVED 2026-10-06 FOR FOUR COLUMNS, AND STILL DERIVED RATHER THAN NAMED. Naming a
   * breakpoint without checking its contents is how the five-column version shipped a 79px
   * overflow with a green suite. The card is drawn at its 330px design width and zoomed by
   * `--mk-steps-zoom`; a frame needs that plus `--mk-steps-pad` a side. Each of those, and the
   * column gap, is set per breakpoint on `.mk-steps-rail` — this reads them back from the
   * stylesheet and redoes the sum at the narrowest viewport each breakpoint covers, with a 15px
   * classic scrollbar taken off. The client's requirement is one row of four at ≥1024px, never
   * three plus an orphan, so the four-column query must be exactly 64rem.
   */
  it("stacks by default, pairs at tablet, and is one row of four from 1024px wherever the card fits", () => {
    expect(css).toMatch(/\.mk-steps-rail\s*\{[^}]*flex-direction:\s*column/);
    // No three-column layout anywhere: that is the shape that left 04 as an orphan.
    expect(css).not.toMatch(/grid-template-columns:\s*repeat\(3/);

    const four = /@media \(min-width: ([\d.]+)rem\)\s*\{\s*\.mk-steps-rail\s*\{([^}]*)\}/g;
    const blocks = [...css.matchAll(four)].map((m) => ({ rem: Number(m[1]), body: m[2]! }));
    const fourAt = blocks.find((b) => /grid-template-columns:\s*repeat\(4/.test(b.body));
    expect(fourAt, "no media query puts the rail into four columns").toBeTruthy();
    expect(fourAt!.rem * 16, "one row of four must start at exactly 1024px").toBe(1024);
    const twoAt = blocks.find((b) => /grid-template-columns:\s*repeat\(2/.test(b.body));
    expect(twoAt, "no two-column tablet step").toBeTruthy();
    expect(twoAt!.rem).toBeLessThan(fourAt!.rem);

    const base = /\.mk-steps-rail\s*\{([^}]*)\}/.exec(css)![1]!;
    const read = (body: string, name: string, fallback?: string): number => {
      const m = new RegExp(`--mk-steps-${name}:\\s*([\\d.]+)(px|rem)?`).exec(body);
      if (!m) return fallback === undefined ? Number.NaN : read(fallback, name);
      return Number(m[1]) * (m[2] === "rem" ? 16 : 1);
    };

    const PAGE_MAX = 1200; // `--mk-page-max`
    const GUTTERS = 80; // `md:px-10`
    const SCROLLBAR = 15;
    const content = (viewport: number) => Math.min(viewport - SCROLLBAR, PAGE_MAX) - GUTTERS;

    // Every breakpoint from the four-column one up, each checked at its own lower edge.
    const upward = blocks.filter((b) => b.rem >= fourAt!.rem).sort((a, b) => a.rem - b.rem);
    let inherited = fourAt!.body;
    for (const block of upward) {
      inherited = block.body + inherited;
      const zoom = read(inherited, "zoom", base);
      const pad = read(inherited, "pad", base);
      const gap = read(inherited, "gap", base);
      const viewport = block.rem * 16;
      const column = (content(viewport) - 3 * gap) / 4;
      const needs = CARD_DESIGN_W * zoom + 2 * pad;
      expect(column, `at ${viewport}px a column is ${column.toFixed(1)}px; a frame needs ${needs.toFixed(1)}px`).toBeGreaterThanOrEqual(needs);
      // And never shrunk past legibility: the card's 30px name stays at least 17px.
      expect(30 * zoom, `the card's name paints at ${(30 * zoom).toFixed(1)}px at ${viewport}px`).toBeGreaterThanOrEqual(17);
    }

    // Tablet pairs, and the stack, at their own narrowest widths.
    const tabletZoom = read(twoAt!.body, "zoom", base);
    const tabletColumn = (content(twoAt!.rem * 16) - read(twoAt!.body, "gap", base)) / 2;
    expect(tabletColumn).toBeGreaterThanOrEqual(CARD_DESIGN_W * tabletZoom + 2 * read(twoAt!.body, "pad", base));
    expect(320 - 48).toBeGreaterThanOrEqual(CARD_DESIGN_W * read(base, "zoom") + 2 * read(base, "pad"));
  });

  it("makes the four steps share subgrid rows, so titles, bodies and frames line up", () => {
    expect(css).toMatch(/\.mk-steps-item\s*\{[^}]*grid-row:\s*span 4[^}]*grid-template-rows:\s*subgrid/);
  });

  it("sizes every frame from the card's own zoom, so frames are identical and fit their crop", () => {
    const frame = /\.mk-steps-frame\s*\{([^}]*)\}/.exec(css)![1]!;
    const height = /height:\s*calc\(([^;]*)\);/.exec(frame);
    expect(height, "the frame's height must be one calc for all four").not.toBeNull();
    expect(height![1]).toContain(`${CARD_WINDOW_H}px * var(--mk-steps-zoom)`);
    expect(frame).toMatch(/overflow:\s*hidden/);
    // The one crop is the window's foot, under a fade.
    expect(css).toMatch(/\.mk-steps-window\s*\{[^}]*mask-image:\s*linear-gradient\(to bottom/);
    // The card and the pass are zoomed by the same variable, in the stylesheet.
    expect(css).toMatch(/\.mk-steps-card,\s*\.mk-steps-window > \.mk-pass\s*\{[^}]*zoom:\s*var\(--mk-steps-zoom\)/);
    // No deck machinery survives.
    expect(css).not.toMatch(/mk-steps-deck/);
  });

  /**
   * ⚠ THE RAIL MAY NOT BE MEASURED IN VIEWPORT UNITS. The first cut of the rebuilt rail gave
   * each segment `width: 100vw` and took `document.scrollWidth` to 2020px against a 1440px
   * viewport — a 580px horizontal scroll on every desktop. The e2e suite catches it; this
   * catches it a minute earlier, and names the cause.
   */
  it("bounds the rail's segments to their own column, never to the viewport", () => {
    const seg = /\.mk-steps-seg\[data-edge="after"\]\s*\{[^}]*\}/.exec(css);
    expect(seg, "no `after` segment rule").not.toBeNull();
    expect(seg![0], "a rail segment is sized in viewport units").not.toMatch(/\d+vw/);
  });

  it("keeps every animated property to transform or opacity, and gates it behind reduced motion", () => {
    for (const block of css.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)) {
      for (const declaration of block[1]!.matchAll(/([a-z-]+)\s*:/g)) {
        expect(["opacity", "transform"]).toContain(declaration[1]);
      }
    }
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
  });

  /**
   * ⚠ THIS ASSERTED "EXACTLY ONE KEYFRAME" UNTIL 2026-09-22, AND THE REQUIREMENT CHANGED.
   *
   * That rule existed because the version before it drew the rule in AND lit each marker on
   * two timelines of different lengths, which drifted and read as a glitch — the client's word
   * was "confusing". They have since asked for the opposite ("there is no animation… add some
   * so it looks lively"), so the guard has to become the thing that was actually load-bearing:
   * not the COUNT of animations, but that every looping one shares a single duration and is
   * offset only by delay. Two animations on one 9s clock cannot drift; two on 9s and 7s can,
   * and that is the defect the old count was a crude proxy for.
   */
  /**
   * ⚠ THIS NOW FORBIDS INFINITE ANIMATION OUTRIGHT, AND IT IS AN ACCESSIBILITY RULE RATHER
   * THAN A STYLE ONE.
   *
   * WCAG 2.2 SC 2.2.2 "Pause, Stop, Hide" is **Level A and normative**: moving content that
   * starts automatically, lasts more than five seconds, and is presented alongside other
   * content must offer a mechanism to pause, stop or hide it. A looping marketing animation in
   * a section full of copy meets all three conditions and this page offers no such control, so
   * an infinite loop here is a conformance failure, not a preference.
   *
   * The section shipped exactly that for a day: a 9s three-phase walk. It also sat in the
   * 5–12s band that a thirteen-site survey found completely empty — every real loop measured
   * was either under ~2s (a caret, a spinner) or over ~10s (ambient drift) — which is the band
   * where NN/g's auto-forwarding research says readers filter motion out as advertising.
   *
   * A one-shot entrance has none of these problems, so the rule is simply: nothing here loops.
   */
  /**
   * ⚠ ADDED 2026-09-22 AFTER THIS SUITE WATCHED THE SITE RETURN HTTP 500 AND STAYED GREEN.
   *
   * A regex deletion in this stylesheet removed a comment's closing delimiter. The remaining
   * prose was then parsed as CSS, PostCSS threw `Unterminated string`, Tailwind failed to
   * build `globals.css`, and every route on the site 500'd — while all 24 tests in this file
   * passed, because every one of them matches PATTERNS in the file's text and none of them
   * asks whether the text is a stylesheet at all.
   *
   * Balanced comment delimiters and balanced braces catch that exact class of damage without
   * pulling a CSS parser into the unit suite. It is a cheap guard for the most expensive
   * possible failure: a stylesheet edit that takes the whole app down.
   */
  it("is still a parseable stylesheet — balanced comments and braces", () => {
    const raw = source("styles/marketing-steps.css");

    const opens = (raw.match(/\/\*/g) ?? []).length;
    const closes = (raw.match(/\*\//g) ?? []).length;
    expect(closes, `${opens} comment openers and ${closes} closers — one is unterminated`).toBe(
      opens,
    );

    // Braces, counted with comments stripped so a `{` inside prose cannot skew it.
    const body = raw.replace(/\/\*[\s\S]*?\*\//g, "");
    const open = (body.match(/\{/g) ?? []).length;
    const close = (body.match(/\}/g) ?? []).length;
    expect(close, `${open} opening braces and ${close} closing braces`).toBe(open);
  });

  /**
   * ⚠ ADDED 2026-09-22 — THE SEQUENCE MUST PLAY WHEN THE READER ARRIVES, NOT WHEN THE PAGE DOES.
   *
   * Every inner animation here used to run on the document clock, so the whole ~1.4s sequence
   * had finished long before anyone scrolled this far and the section read as a finished still
   * ("as the user scrolls, the animation should load" — the client). The rail is wrapped in
   * `<MkReveal>`, which flips `data-mk-reveal` to `"in"` once on scroll-in; every animation rule
   * must be keyed on that, and the pre-state it shows while `"armed"` must be displaced rather
   * than hidden — `marketing.spec.ts` fails any armed element under opacity 1, and a page that
   * lands mid-scroll must never show a screen of invisible content.
   */
  it("keys every inner animation on the section's own scroll-in, and hides nothing before it", () => {
    const rules = [...css.matchAll(/([^{}]+)\{[^{}]*\banimation:[^}]*\}/g)].map((m) => m[1]!.trim());
    expect(rules.length, "expected animation rules").toBeGreaterThan(0);
    for (const selector of rules) {
      expect(
        selector,
        `an animation is not gated on the reveal: ${selector}`,
      ).toMatch(/\[data-mk-reveal="in"\]/);
    }

    // Outside `@keyframes`, no declaration may hide anything: the armed pre-state is a
    // translate, and the resting state (no attribute) is the finished row.
    const outsideKeyframes = css.replace(/@keyframes[^{]+\{[\s\S]*?\n\}/g, "");
    /* `0(?![.\d])`, not `0\b`: `\b` sits between the `0` and the `.` of `opacity: 0.16` (the
       rail segment's resting tint), so the bare word boundary flagged a value that hides
       nothing. Only a literal zero counts. */
    expect(outsideKeyframes, "something is hidden before the reveal").not.toMatch(/opacity:\s*0(?![.\d])/);

    // And the fill is `backwards`, never `both`: `both` would pin the keyframe's `from` state
    // (opacity 0) onto the element from load until the reveal — hidden by another route.
    expect(css, "a one-shot uses `both` and would hide its element until scroll-in").not.toMatch(
      /animation:[^;]*\bboth\b/,
    );
  });

  it("ships no infinite animation — WCAG 2.2.2 applies and this page has no pause control", () => {
    const loops = [...css.matchAll(/animation[^;]*\binfinite\b/g)].map((m) => m[0]);
    expect(
      loops,
      `these loop forever with no way to stop them: ${loops.join(" | ")}`,
    ).toHaveLength(0);
  });

  it("never reintroduces the pinned sequence this repo already removed once", () => {
    // The survey's runner-up composition needs `position: sticky`; `pinned-sequence.tsx` was
    // deleted from this repo and the adjacent section's suite forbids sticky outright. If it
    // ever comes back it should be a decision, not a diff.
    expect(css).not.toMatch(/position:\s*sticky/);
  });
});

/* ⚠ REWRITTEN 2026-09-28 (L1). The close carried an inline waitlist capture — a name-and-email
   `<LeadForm>` — and three of the four tests here drove it end to end against a stubbed
   `/api/leads`. The client asked for the waitlist to come off the homepage, so the form went and
   the close is one link (now "Get Started"). The lead pipeline is still covered where it still
   lives: `/waitlist` (`tests/e2e/marketing-pages.spec.ts`). */
describe("Close — the deep ground and one call to action", () => {
  it("renders the headline, the body, and exactly one link — the front door", () => {
    renderWithProviders(<Close />);

    expect(screen.getByRole("heading", { name: close.headline })).toBeInTheDocument();
    expect(screen.getByText(close.body)).toBeInTheDocument();

    /* `tests/e2e/marketing.spec.ts` asserts "the close carries exactly one action" against the
       rendered page; this is the same property, pinned here so a regression is caught locally. */
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", close.cta.href);
    expect(links[0]).toHaveTextContent(close.cta.label);
  });

  it("carries no waitlist form or copy any more (client, 2026-09-28)", () => {
    renderWithProviders(<Close />);

    expect(document.querySelector("form")).toBeNull();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: waitlistPage.submitLabel })).toBeNull();
    expect(document.body.textContent ?? "").not.toMatch(/waitlist/i);
  });
});

describe("no colour literal anywhere in either section or the shared partial", () => {
  it.each(OWNED)("%s reads only `--mk-*` tokens", (file) => {
    expect(source(file)).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/);
  });

  it.each(OWNED.filter((f) => f.endsWith(".tsx")))(
    "%s writes no new code against the `--mk-green-*` compatibility ladder",
    (file) => {
      expect(source(file)).not.toMatch(/mk-green/);
    },
  );
});
