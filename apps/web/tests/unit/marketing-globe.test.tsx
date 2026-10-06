import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "../helpers/render";
import {
  cityAngleDeg,
  GLOBE_ARC_MAX,
  GLOBE_ARC_MAX_DEG,
  GLOBE_ARC_MIN_DEG,
  GLOBE_ARC_S,
  GLOBE_ARC_SEEN,
  GLOBE_ARC_SLOT_S,
  GLOBE_ARC_TRACE_S,
  GLOBE_CITIES,
  GLOBE_PULSE_LIFE_S,
  GLOBE_PULSE_REACH_PX,
  GLOBE_STILL_LON,
  landVectors,
  latLonVector,
  markerSeen,
  pickArcPair,
  project,
  pulsePick,
  seededRandom,
  stillMarkers,
  viewMatrix,
  wrapDeg,
} from "@/components/marketing/globe-geometry";
import { WorldMap } from "@/components/marketing/world-map";
import { howItWorks } from "@/fixtures/marketing";
import { MAYA_CITIES } from "@/fixtures/marketing-identity";

/**
 * The globe (2026-09-29; reworked 2026-10-06) — `world-map.tsx`'s band, `world-globe.tsx`'s
 * island, `globe-geometry.ts`'s maths.
 *
 * ⚠ happy-dom has no canvas and no layout, so nothing here looks at pixels: the look, the frame
 * rate and the viewports are verified in a real browser. What IS pinned is the contract a later
 * edit could quietly break — WCAG 2.2.2's pause control, reduced motion never starting a loop or
 * a pulse, the server/client split, the far side never showing through, the pulse being
 * deterministic and staggered, and the band's statement coming from the fixture verbatim.
 *
 * ⚠ REWRITTEN 2026-10-06 WITH THE CLIENT'S ASK. The four-city list beside the globe, the
 * facing-city highlight and the on-globe name are gone, so the tests that pinned them (the list's
 * numbers and addresses, `facingCity`'s once-per-turn order, `labelShift`) went with the code
 * they tested. Each is replaced by the property that took its place, below.
 */

const SRC = resolve(__dirname, "../../src");
const source = (relative: string) => readFileSync(resolve(SRC, relative), "utf8");
/** Comments out, so the files' own history of what they replaced cannot trip a scan. */
const code = (relative: string) =>
  source(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");

const band = () => <WorldMap label={howItWorks.map.label} alt={howItWorks.map.alt} />;

/** A 2D context that accepts every call, remembers what was set on it, and counts the calls. */
function stubCanvas() {
  const gradient = { addColorStop: () => undefined };
  const store: Record<string | symbol, unknown> = {};
  const calls: Record<string, number> = {};
  const ctx = new Proxy(store, {
    get: (t, k) => {
      if (k in t) return t[k];
      if (k === "createRadialGradient" || k === "createLinearGradient") return () => gradient;
      return () => {
        calls[String(k)] = (calls[String(k)] ?? 0) + 1;
      };
    },
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ctx as unknown as CanvasRenderingContext2D,
  );
  return calls;
}

function stubMotion({ reduce }: { reduce: boolean }) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: reduce && query.includes("prefers-reduced-motion: reduce"),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

/** Every observed element is on screen at once — the band has scrolled into view. */
class OnScreen {
  constructor(private readonly cb: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.cb([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function stubFrames() {
  const frames: FrameRequestCallback[] = [];
  const raf = vi.fn((cb: FrameRequestCallback) => {
    frames.push(cb);
    return 1;
  });
  const caf = vi.fn();
  vi.stubGlobal("requestAnimationFrame", raf);
  vi.stubGlobal("cancelAnimationFrame", caf);
  vi.stubGlobal("IntersectionObserver", OnScreen);
  /** Plays the loop forward `seconds` of loop time in 50 ms frames, as the browser would. */
  const play = (seconds: number) => {
    let now = 0;
    for (let t = 0; t <= seconds + 1e-9; t += 0.05) {
      now = t * 1000;
      frames.splice(0).forEach((cb) => cb(now));
    }
  };
  return { raf, caf, play };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the globe — where it runs", () => {
  it("is a client island inside a band and a section that stay server components", () => {
    const isClient = (f: string) => /^\s*["']use client["'];?\s*$/m.test(source(f));
    expect(isClient("components/marketing/world-globe.tsx")).toBe(true);
    expect(isClient("components/marketing/world-map.tsx")).toBe(false);
    expect(isClient("components/marketing/how-it-works.tsx")).toBe(false);
    // The geometry is shared with the server-rendered still, so it must not be a client module.
    expect(isClient("components/marketing/globe-geometry.ts")).toBe(false);
  });

  it("server-renders a finished still — land and every near-side marker — so first paint is never empty", () => {
    const html = renderToStaticMarkup(band());
    const doc = new DOMParser().parseFromString(html, "text/html");
    const stage = doc.querySelector(".mk-globe__stage")!;
    expect(stage.getAttribute("data-globe")).toBe("still");
    expect(stage.querySelectorAll("svg .mk-globe__land").length).toBeGreaterThan(4);
    const near = stillMarkers(viewMatrix(GLOBE_STILL_LON));
    expect(near.length).toBeGreaterThanOrEqual(5);
    expect(stage.querySelectorAll("svg .mk-globe__markers circle")).toHaveLength(near.length);
    // And the statement is in the server HTML, not waiting on the island.
    expect(doc.querySelector(".mk-map__copy")?.textContent).toContain(howItWorks.map.statement.lead);
  });

  it("keeps the pause control out of the page until a script says the globe can move", () => {
    const css = readFileSync(resolve(SRC, "styles/marketing-steps.css"), "utf8");
    expect(css).toMatch(/\.mk-globe__pause\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.mk-globe\[data-globe-motion\] \.mk-globe__pause\s*\{[^}]*display:\s*inline-flex/);
  });
});

describe("the globe — WCAG 2.2.2 and reduced motion", () => {
  it("turns once on screen, and carries a named pause control that stops it", () => {
    stubCanvas();
    stubMotion({ reduce: false });
    const { raf, caf } = stubFrames();
    const { container } = renderWithProviders(band());

    expect(raf).toHaveBeenCalled();
    expect(container.querySelector(".mk-globe")).toHaveAttribute("data-globe-motion");
    expect(container.querySelector(".mk-globe__stage")).toHaveAttribute("data-globe", "live");

    // The visible word is the start of the name, so voice control and screen readers agree.
    const pause = screen.getByRole("button", { name: "Pause the globe" });
    fireEvent.click(pause);
    expect(caf).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Play the globe" })).toBeInTheDocument();
  });

  it("never starts a loop or a pulse under prefers-reduced-motion — one still, static dots", () => {
    const calls = stubCanvas();
    stubMotion({ reduce: true });
    const { raf, play } = stubFrames();
    const { container } = renderWithProviders(band());

    expect(raf).not.toHaveBeenCalled();
    expect(container.querySelector(".mk-globe")).not.toHaveAttribute("data-globe-motion");
    // The canvas did draw (the markers are fills)…
    expect(calls.fill ?? 0).toBeGreaterThan(10);
    // …but at most one stroke, the rim (skipped here: happy-dom's stage has no size). No ring,
    // no arc — every pulse is a stroke, and the motion test below sees them on the same frame.
    expect(calls.stroke ?? 0).toBeLessThanOrEqual(1);
    const strokes = calls.stroke ?? 0;
    play(5);
    expect(calls.stroke ?? 0).toBe(strokes);
  });

  it("sends updates along arcs when motion is allowed — the loop strokes them, frame after frame", () => {
    const calls = stubCanvas();
    stubMotion({ reduce: false });
    const { play } = stubFrames();
    renderWithProviders(band());
    // The first frame already launches one: an arc is a stroke.
    expect(calls.stroke ?? 0).toBeGreaterThanOrEqual(1);
    const before = calls.stroke ?? 0;
    play(6);
    // A trace and a comet per arc, over six seconds of overlapping arcs: far more than rings alone.
    expect((calls.stroke ?? 0) - before).toBeGreaterThan(100);
  });

  it("keeps the arcs thin and few — at most three in the air, a handful of strokes a frame", () => {
    const calls = stubCanvas();
    stubMotion({ reduce: false });
    const { play } = stubFrames();
    renderWithProviders(band());
    const base = calls.stroke ?? 0;
    const seconds = 12;
    const frames = Math.floor(seconds / 0.05) + 1;
    play(seconds);
    // Per frame: ≤ GLOBE_ARC_MAX arcs × (1 trace + 3 comet strokes), plus the rings answering landings
    // (a ring lives 1.8 s, a slot is 1.2 s: at most two).
    const perFrame = GLOBE_ARC_MAX * 4 + 2;
    expect((calls.stroke ?? 0) - base).toBeLessThanOrEqual(perFrame * frames);
    // The arc's life (flight plus trace) against its slot caps what can exist at once.
    expect(Math.ceil((GLOBE_ARC_S + GLOBE_ARC_TRACE_S) / GLOBE_ARC_SLOT_S)).toBeLessThanOrEqual(GLOBE_ARC_MAX);
    expect(GLOBE_ARC_MAX).toBeLessThanOrEqual(3);
    expect(GLOBE_ARC_S).toBeGreaterThanOrEqual(1.4);
    expect(GLOBE_ARC_S).toBeLessThanOrEqual(2);

    const src = code("components/marketing/world-globe.tsx");
    // Strokes 1–1.25 px wide.
    expect(Number(src.match(/const ARC_WIDTH = ([\d.]+)/)?.[1])).toBeLessThanOrEqual(1.25);
    expect(Number(src.match(/const RING_WIDTH = ([\d.]+)/)?.[1])).toBeLessThanOrEqual(1.25);
    // The arcs are really there…
    expect(src).toMatch(/function drawArcs/);
    expect(src).toMatch(/pickArcPair/);
    // …and nothing diffuse: no blur, shadow or filter, and no gradient per frame — the only radial
    // gradients are the globe's own body and atmosphere, painted once into the base layer, and
    // there is no linear gradient at all.
    expect(src).not.toMatch(/shadowBlur|shadowColor|\.filter\s*=|blur/i);
    expect(src.match(/createRadialGradient/g)).toHaveLength(2);
    expect(src).not.toMatch(/createLinearGradient/);
  });

  it("keeps the ring inside a few pixels and a life under two seconds", () => {
    expect(GLOBE_PULSE_REACH_PX).toBeGreaterThanOrEqual(10);
    expect(GLOBE_PULSE_REACH_PX).toBeLessThanOrEqual(14);
    expect(GLOBE_PULSE_LIFE_S).toBeGreaterThanOrEqual(1.6);
    expect(GLOBE_PULSE_LIFE_S).toBeLessThanOrEqual(2);
  });

  it("stops sending when paused — no frames, so no new arc and no new ring", () => {
    stubCanvas();
    stubMotion({ reduce: false });
    const { play, caf, raf } = stubFrames();
    renderWithProviders(band());
    fireEvent.click(screen.getByRole("button", { name: "Pause the globe" }));
    expect(caf).toHaveBeenCalled();
    const requested = raf.mock.calls.length;
    play(3);
    expect(raf.mock.calls.length).toBe(requested);
  });

  it("does not turn before the band is on screen", () => {
    stubCanvas();
    stubMotion({ reduce: false });
    const { raf } = stubFrames();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
    renderWithProviders(band());
    expect(raf).not.toHaveBeenCalled();
  });

  it("keeps the server still when there is no canvas to draw on", () => {
    stubMotion({ reduce: false });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
    const { raf } = stubFrames();
    const { container } = renderWithProviders(band());
    expect(raf).not.toHaveBeenCalled();
    expect(container.querySelector(".mk-globe__stage")).toHaveAttribute("data-globe", "still");
    expect(container.querySelector(".mk-globe")).not.toHaveAttribute("data-globe-motion");
  });

  it("is decorative: the stage is hidden from assistive tech, the statement is not, nothing is announced", () => {
    const { container } = renderWithProviders(band());
    expect(container.querySelector(".mk-globe__stage")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("[aria-live]")).toBeNull();
    const statement = container.querySelector(".mk-map__copy")!;
    expect(statement.closest("[aria-hidden]")).toBeNull();
  });
});

/**
 * The client, 2026-10-06: *"remove the details on the right (not sure what they are) … Where the
 * text currently is, let's just add the logo and 'it's time you use ContactBook to manage your
 * global network. It's not what you know, it's who you know.'"*
 */
describe("the globe band — the logo and the statement replace the four-city list", () => {
  it("shows the nav's logo, then the client's two sentences verbatim, the second set apart", () => {
    const { container } = renderWithProviders(band());
    const statement = container.querySelector(".mk-map__statement")!;
    const logo = statement.querySelector("img")!;
    expect(logo.getAttribute("src")).toBe("/brand/contactbook-logo-nav.png");
    // Decorative: the sentence beside it names ContactBook itself.
    expect(logo).toHaveAttribute("alt", "");
    expect(logo.compareDocumentPosition(statement.querySelector(".mk-map__copy")!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    const copy = statement.querySelector(".mk-map__copy")!;
    expect(copy.textContent).toBe(
      "It's time you use ContactBook to manage your global network. It's not what you know, it's who you know.",
    );
    expect(copy.querySelector(".mk-map__punchline")?.textContent).toBe(howItWorks.map.statement.punchline);
    // The copy lives in the fixture, never typed into the band or the island.
    for (const file of ["components/marketing/world-map.tsx", "components/marketing/world-globe.tsx"]) {
      expect(code(file), file).not.toContain("who you know");
    }
  });

  it("carries none of the four offices — no list, no number, no address, no highlight", () => {
    const { container } = renderWithProviders(band());
    expect(container.querySelector(".mk-map__legend, .mk-map__place, .mk-map__pin, .mk-globe__name")).toBeNull();
    expect(container.querySelector("[data-active]")).toBeNull();
    const text = container.textContent ?? "";
    for (const city of MAYA_CITIES) {
      expect(text, city.city).not.toContain(city.phone);
      expect(text, city.city).not.toContain(city.address);
    }
  });
});

describe("the globe — its geometry", () => {
  it("decodes the land as unit vectors — the whole sphere, not the flat map's crop", () => {
    const v = landVectors();
    expect(v.length / 3).toBeGreaterThan(4000);
    let north = 0;
    for (let i = 0; i < v.length; i += 3) {
      expect(Math.abs(Math.hypot(v[i]!, v[i + 1]!, v[i + 2]!) - 1)).toBeLessThan(1e-5);
      if (v[i + 1]! > Math.sin((75 * Math.PI) / 180)) north++;
    }
    // Greenland and the Arctic islands: land the flat map's 72°N crop could not carry.
    expect(north).toBeGreaterThan(20);
  });

  it("marks 14–18 well-known cities, unique, spread so no two crowd each other", () => {
    expect(GLOBE_CITIES.length).toBeGreaterThanOrEqual(14);
    expect(GLOBE_CITIES.length).toBeLessThanOrEqual(18);
    expect(new Set(GLOBE_CITIES.map(([name]) => name)).size).toBe(GLOBE_CITIES.length);
    for (const [name, lat, lon] of GLOBE_CITIES) {
      expect(Math.abs(lat), name).toBeLessThan(70);
      expect(Math.abs(lon), name).toBeLessThanOrEqual(180);
    }
    // No two markers within 12° of arc: dots never crowd and rings never touch.
    const v = GLOBE_CITIES.map(([, la, lo]) => latLonVector(la, lo));
    for (let i = 0; i < v.length; i++) {
      for (let j = i + 1; j < v.length; j++) {
        const dot = v[i]![0] * v[j]![0] + v[i]![1] * v[j]![1] + v[i]![2] * v[j]![2];
        const deg = (Math.acos(Math.min(1, dot)) * 180) / Math.PI;
        expect(deg, `${GLOBE_CITIES[i]![0]} / ${GLOBE_CITIES[j]![0]}`).toBeGreaterThanOrEqual(12);
      }
    }
    // Rough continental boxes: each must hold at least one marker.
    const within = (la0: number, la1: number, lo0: number, lo1: number) =>
      GLOBE_CITIES.filter(([, la, lo]) => la >= la0 && la <= la1 && lo >= lo0 && lo <= lo1).length;
    const continents = {
      "North America": within(14, 70, -170, -50),
      "South America": within(-56, 13, -82, -34),
      Europe: within(35, 70, -25, 45),
      Africa: within(-35, 37, -18, 52),
      Asia: within(-10, 70, 45, 150),
      Oceania: within(-48, -10, 110, 180),
    };
    for (const [continent, n] of Object.entries(continents)) expect(n, continent).toBeGreaterThanOrEqual(1);
    // The ones the client's brief names by example, spot-checked against their coordinates.
    const at = (name: string) => GLOBE_CITIES.find(([n]) => n === name)!;
    expect(at("London").slice(1)).toEqual([51.5074, -0.1278]);
    expect(at("Sydney").slice(1)).toEqual([-33.8688, 151.2093]);
    expect(at("São Paulo").slice(1)).toEqual([-23.5505, -46.6333]);
  });

  it("never shows a marker through the sphere — anything behind the limb is invisible", () => {
    for (let turned = 0; turned < 360; turned += 7.5) {
      const m = viewMatrix(wrapDeg(GLOBE_STILL_LON - turned));
      let shown = 0;
      for (const [name, lat, lon] of GLOBE_CITIES) {
        const z = project(m, latLonVector(lat, lon)).z;
        if (z <= 0) expect(markerSeen(z), name).toBe(0);
        if (markerSeen(z) > 0) shown++;
      }
      expect(stillMarkers(m)).toHaveLength(shown);
      // Never an empty face: at least a few cities on the near side at any angle.
      expect(shown, `at ${turned}°`).toBeGreaterThanOrEqual(4);
    }
  });

  it("picks each arc's pair deterministically — far apart, near side, never the same pair twice running", () => {
    // The same slot and the same visible set give the same pair: no randomness in the schedule.
    const m0 = viewMatrix(GLOBE_STILL_LON);
    const seenNow = GLOBE_CITIES.flatMap(([, la, lo], i) =>
      markerSeen(project(m0, latLonVector(la, lo)).z) >= GLOBE_ARC_SEEN ? [i] : [],
    );
    expect(seenNow.length).toBeGreaterThanOrEqual(5);
    expect(pickArcPair(11, seenNow, null)).toEqual(pickArcPair(11, seenNow, null));

    // Walk a whole turn, one slot at a time, with the globe turning as it does in the loop.
    let prev: [number, number] | null = null;
    const pairs = new Set<string>();
    let slots = 0;
    for (let slot = 0; slot < 300; slot++) {
      const lon = wrapDeg(GLOBE_STILL_LON - ((slot * GLOBE_ARC_SLOT_S * 360) / 36));
      const m = viewMatrix(lon);
      const visible = GLOBE_CITIES.flatMap(([, la, lo], i) =>
        markerSeen(project(m, latLonVector(la, lo)).z) >= GLOBE_ARC_SEEN ? [i] : [],
      );
      const pair = pickArcPair(slot, visible, prev);
      expect(pair, `slot ${slot} found no pair`).not.toBeNull();
      const [from, to] = pair!;
      expect(visible).toContain(from);
      expect(visible).toContain(to);
      expect(from).not.toBe(to);
      expect(cityAngleDeg(from, to)).toBeGreaterThanOrEqual(GLOBE_ARC_MIN_DEG);
      expect(cityAngleDeg(from, to)).toBeLessThanOrEqual(GLOBE_ARC_MAX_DEG);
      if (prev) expect([from, to]).not.toEqual(prev);
      if (prev) expect([to, from]).not.toEqual(prev);
      pairs.add(`${from}-${to}`);
      prev = pair;
      slots++;
    }
    // It tells a story, not one route on repeat: many different pairs over a turn.
    expect(pairs.size).toBeGreaterThan(30);
    expect(slots).toBe(300);
    // Nothing visible, nothing to send.
    expect(pickArcPair(3, [], null)).toBeNull();
    expect(pickArcPair(3, [0], null)).toBeNull();
  });

  it("answers each landing with one calm ring and picks its senders by a pure function of the slot", () => {
    expect(pulsePick(7)).toBe(pulsePick(7));
    const picks = Array.from({ length: 60 }, (_, k) => pulsePick(k));
    for (const p of picks) expect(p >= 0 && p < 1).toBe(true);
    // And it varies: the sequence is not one city over and over.
    expect(new Set(picks.map((p) => p.toFixed(6))).size).toBeGreaterThan(50);
    // The ring is a short answer, not a wave: shorter than two seconds, a dozen pixels.
    expect(GLOBE_PULSE_LIFE_S).toBeLessThanOrEqual(2);
    // Arcs overlap, but start staggered: a new one no more often than the slot, never at once.
    expect(GLOBE_ARC_SLOT_S).toBeGreaterThanOrEqual(1);
  });

  it("uses a seeded generator, never Math.random, so every load plays the same sequence", () => {
    const a = seededRandom(42), b = seededRandom(42);
    const first = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(first);
    for (const v of first) expect(v >= 0 && v < 1).toBe(true);
    for (const file of ["components/marketing/world-globe.tsx", "components/marketing/globe-geometry.ts"]) {
      expect(code(file), file).not.toMatch(/Math\.random/);
    }
  });
});
