import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "../helpers/render";
import { Close } from "@/components/marketing/close";
import { HowItWorks } from "@/components/marketing/how-it-works";
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
 * ⚠ REWRITTEN 2026-09-21 WITH THE SECTION'S THIRD BUILD. The suite this replaces asserted a
 * five-column rail, three authored SVG diagrams and a `scale={0.24}` card thumbnail — and it
 * was green throughout the two client rejections, because every one of those assertions was
 * about a mechanism EXISTING rather than about the mechanism producing a legible result. The
 * two properties the old suite could not see are the two that actually failed:
 *
 *   · a visual can be present and still be sub-legible (98px wide, a 30px name painting at
 *     ~9px);
 *   · a row can be consistent in code and incoherent on screen, if its members are built three
 *     different ways.
 *
 * happy-dom has no layout engine, so neither can be measured here. What CAN be pinned is the
 * construction that produced them, and that is what the tests below do: the column COUNT, the
 * crop-not-shrink mechanism, and the one-construction-per-row rule. See `how-it-works.tsx`'s
 * header for the survey and the numbers.
 */
describe("HowItWorks — the three-step rail", () => {
  const RAIL_COUNT = 3;

  it("puts the three actions in the rail and the two properties beneath it", () => {
    const { container } = renderWithProviders(<HowItWorks />);

    expect(container.querySelectorAll(".mk-steps-rail")).toHaveLength(1);
    expect(container.querySelectorAll(".mk-steps-item")).toHaveLength(RAIL_COUNT);
    expect(container.querySelectorAll(".mk-steps-marker")).toHaveLength(RAIL_COUNT);

    /* ⚠ NOT ONE WORD OF THE CLIENT'S COPY IS DROPPED — the split is about hierarchy, not about
       cutting. Every step in the fixture still renders its title and its body somewhere in the
       section; the first three get a column, a numbered disc and a product fragment, and the
       last two get quieter type under a hairline because they are properties rather than
       actions. A future edit that "simplifies" by deleting a step fails here. */
    for (const step of howItWorks.steps) {
      expect(screen.getByRole("heading", { level: 3, name: step.title })).toBeInTheDocument();
      expect(screen.getByText(step.body)).toBeInTheDocument();
    }

    expect(container.querySelectorAll(".mk-steps-after__item")).toHaveLength(
      howItWorks.steps.length - RAIL_COUNT,
    );
  });

  it("prints an ordinal inside every marker, and only for the rail's own steps", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const printed = [...container.querySelectorAll(".mk-steps-marker__n")].map((n) =>
      n.textContent?.trim(),
    );
    expect(printed).toEqual(howItWorks.steps.slice(0, RAIL_COUNT).map((s) => s.ordinal));
  });

  it("draws one rule through the markers, with no end hanging off either outer edge", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    /* Each interior boundary draws two halves — the step before it draws "after", the step
       after it draws "before" — and the two outer ends draw none. Derived, so it survives a
       change to RAIL_COUNT. */
    expect(container.querySelectorAll("[data-edge]")).toHaveLength(2 * (RAIL_COUNT - 1));
  });

  /**
   * ⚠ REPLACED THE `data-swatch` ASSERTION, 2026-09-22. A static navy fill on step 02's disc
   * marked "the step that claims a colour" — and once the walk started filling each disc in
   * turn, a permanently filled one read as "this step is always active". Two signals, one
   * slot. The claim still lands, through the fragment rather than the dot: step 02 renders two
   * cards in two different palettes, which is what "give it a colour" actually looks like.
   */
  it("marks the colour claim with two real palettes, not a permanently lit disc", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    expect(container.querySelectorAll("[data-swatch]")).toHaveLength(0);

    const colourStep = howItWorks.steps.find((s) => /colour/i.test(s.body));
    expect(colourStep, "the fixture should carry a step that claims a colour").toBeTruthy();
    const item = screen.getByRole("heading", { level: 3, name: colourStep!.title }).closest("li")!;

    const palettes = new Set(
      [...item.querySelectorAll("[data-palette-id]")].map((n) => n.getAttribute("data-palette-id")),
    );
    expect(palettes.size, "the colour step should show more than one palette").toBeGreaterThan(1);
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

describe("HowItWorks — the frames, and the rule that finally made the row cohere", () => {
  /**
   * ⚠ FIFTH BUILD, 2026-09-22. The suite this replaces pinned a "fragment window", a card
   * `scale`, a `height` crop and a fanned pair — the exact mechanisms of the four builds the
   * client rejected. Every one of those tests was green on every one of those rejections,
   * because each guarded a mechanism's presence and none guarded the property that failed:
   * three different KINDS of object in three identical columns never read as one row.
   *
   * What is pinned now is the construction that fixed it — every column holds the same visible
   * frame, and every artefact inside one is the same product component, complete.
   */
  it("gives every rail step the identical frame", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const frames = [...container.querySelectorAll(".mk-steps-frame")];
    expect(frames).toHaveLength(3);
    for (const frame of frames) {
      // One class, so one size, one hairline, one ground. A per-step variant is how the old row
      // went ragged.
      expect(frame.className.trim()).toBe("mk-steps-frame");
      expect(frame.querySelector(".mk-steps-frame__label"), "every frame carries a label").not.toBeNull();
    }
  });

  it("puts the same artefact in every frame that shows a card — the share face, complete", () => {
    const src = code("components/marketing/how-it-works.tsx");
    // The one renderer. `CardPageThumb` is gone from this file on purpose: it is fluid and had
    // to be cropped, and a crop with no frame to explain it was the recurring "glitch".
    expect(src).toContain("ShareFace");
    expect(src).not.toContain("CardPageThumb");
    // No authored linework, no glyph standing in for a verb.
    expect(src).not.toMatch(/function\s+\w*(Diagram|Annotation)\s*\(/);
    expect(src).not.toContain("<path");
  });

  it("deals a deck of three faces in three different palettes behind one readable front card", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const deck = container.querySelector("[data-steps-deck] .mk-steps-deck");
    expect(deck, "expected the deck in frame 02").not.toBeNull();

    const cards = [...deck!.querySelectorAll(".mk-steps-deck__card")];
    expect(cards).toHaveLength(3);

    // Every card carries its position; the stylesheet turns it into the diagonal offset and
    // the deal order, so a missing index collapses the whole deck onto one spot.
    const indices = cards.map((c) => c.getAttribute("style") ?? "");
    for (const i of [0, 1, 2]) {
      expect(indices.some((st) => st.includes(`--mk-steps-deck-i: ${i}`)), `no card at deck index ${i}`).toBe(true);
    }

    // Three palettes, not one card thrice — "give it a colour" is the claim.
    const palettes = new Set(
      [...deck!.querySelectorAll("[data-palette-id]")].map((n) => n.getAttribute("data-palette-id")),
    );
    expect(palettes.size).toBe(3);
  });

  it("makes the shared face in frame 03 the front card of frame 02's deck", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const front = container.querySelector('[data-steps-deck] .mk-steps-deck__card[style*="--mk-steps-deck-i: 0"] [data-palette-id]');
    const hero = container.querySelector("[data-steps-share] [data-palette-id]");
    expect(front, "no front card").not.toBeNull();
    expect(hero, "no hero face").not.toBeNull();
    // Same palette AND same card root identity: the object the reader watches get built is the
    // object they watch get shared. This is the survey's "panels must share an object" rule.
    expect(hero!.getAttribute("data-palette-id")).toBe(front!.getAttribute("data-palette-id"));
  });

  /** 2026-09-28: the records are Maya's (`mayaProfile`), not the app fixture user's. */
  it("draws the profile from Maya's real records, numbers formatted as they are written", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const panel = container.querySelector("[data-steps-profile]");
    expect(panel, "expected the profile frame body").not.toBeNull();

    const rows = [...panel!.querySelectorAll(".mk-steps-profile__row")];
    expect(rows.length).toBeGreaterThan(5);

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
   * row AND see the filter working. If the business card's `fieldIds` drift, this fails.
   */
  it("lists the fields the front card actually carries, plus one it leaves off", () => {
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

  it("shows all four cities' numbers in the profile and on the map", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    const profile = container.querySelector("[data-steps-profile]")!.textContent ?? "";
    for (const city of MAYA_CITIES) {
      expect(profile, `${city.city}'s number is not in the profile`).toContain(city.phone);
    }

    const map = container.querySelector("[data-steps-map]");
    expect(map, "no map band").not.toBeNull();
    /* ⚠ CHANGED 2026-09-29 WITH THE GLOBE. This asserted the flat map's `svg[role="img"]` carried
       `howItWorks.map.alt`. The globe is decorative by design — its whole stage is `aria-hidden`
       and the list below is the accessible content — so an image name would only read the list
       out twice. What must hold now is that the picture is hidden and the list is not. */
    expect(map!.querySelector(".mk-globe__stage")).toHaveAttribute("aria-hidden", "true");
    expect(map!.querySelector(".mk-map__legend")!.closest("[aria-hidden]")).toBeNull();
    expect(map!.querySelectorAll(".mk-map__pin")).toHaveLength(MAYA_CITIES.length);

    const legend = [...map!.querySelectorAll(".mk-map__place")];
    expect(legend).toHaveLength(MAYA_CITIES.length);
    MAYA_CITIES.forEach((city, i) => {
      expect(legend[i]!.textContent).toContain(city.city);
      expect(legend[i]!.textContent).toContain(city.phone);
      expect(legend[i]!.textContent).toContain(city.address);
    });
  });

  /* Still true of the globe: its server-rendered still places each pin by percentage inside the
     still's own square frame, the way the flat map placed them inside its box. */
  it("places every pin inside the map's own box", () => {
    const { container } = renderWithProviders(<HowItWorks />);
    for (const pin of container.querySelectorAll<HTMLElement>(".mk-map__pin")) {
      const left = Number.parseFloat(pin.style.left);
      const top = Number.parseFloat(pin.style.top);
      expect(left, pin.dataset.city).toBeGreaterThan(0);
      expect(left, pin.dataset.city).toBeLessThan(100);
      expect(top, pin.dataset.city).toBeGreaterThan(0);
      expect(top, pin.dataset.city).toBeLessThan(100);
    }
  });

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
   * ⚠ RE-DERIVED 2026-09-22. The fragment stopped having a fixed `--mk-steps-frag-w` when it
   * became the column's full width (the alignment fix), so the old arithmetic lost its input.
   * The constraint it was protecting is unchanged and is now expressed against the thing that
   * IS still fixed: a card render is `336 × scale` px wide and does not reflow, so a column
   * narrower than one card clips the fan on both edges. Naming a breakpoint without checking
   * this is exactly how the five-column version shipped a 79px viewport overflow with a green
   * suite.
   */
  it("stacks by default and only goes to three columns where the frame's contents fit", () => {
    expect(css).toMatch(/\.mk-steps-rail\s*\{[^}]*flex-direction:\s*column/);

    const breakpoint = /@media \(min-width: ([\d.]+)rem\)[\s\S]*?grid-template-columns:\s*repeat\(3/.exec(css);
    expect(breakpoint, "no media query puts the rail into three columns").not.toBeNull();

    const viewport = Number(breakpoint![1]) * 16;
    const gap = 32;
    const column = (viewport - 80 - 2 * gap) / 3;

    /* The widest thing a frame must hold, read from the component: the hero face, or the deck's
       face plus its diagonal offsets — whichever is wider — plus the frame's own side padding.
       Derived, so moving any of those numbers recomputes this instead of silently overflowing. */
    const src = code("components/marketing/how-it-works.tsx");
    const num = (name: string) => Number(new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(src)![1]);
    const heroW = num("HERO_FACE_W");
    const deckW = num("DECK_FACE_W") + 2 * num("DECK_STEP");
    const widest = Math.max(heroW, deckW) + 2 * 22;
    expect(column, `a column is ${Math.round(column)}px at the breakpoint; a frame needs ${widest}px`).toBeGreaterThan(widest);
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
   the close is one "Create your card" link. The lead pipeline is still covered where it still
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
