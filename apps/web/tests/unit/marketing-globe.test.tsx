import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "../helpers/render";
import {
  facingCity,
  GLOBE_STILL_LON,
  labelShift,
  landVectors,
  latLonVector,
  project,
  viewMatrix,
  wrapDeg,
} from "@/components/marketing/globe-geometry";
import { WorldMap } from "@/components/marketing/world-map";
import { howItWorks } from "@/fixtures/marketing";
import { MAYA_CITIES } from "@/fixtures/marketing-identity";

/**
 * The four-cities globe (2026-09-29) — `world-map.tsx`'s band, `world-globe.tsx`'s island,
 * `globe-geometry.ts`'s maths.
 *
 * ⚠ happy-dom has no canvas and no layout, so nothing here looks at pixels: the look, the frame
 * rate and the three viewports are verified in a real browser. What IS pinned is the contract a
 * later edit could quietly break — WCAG 2.2.2's pause control, reduced motion never starting a
 * loop, the server/client split, and the cities coming from the fixture.
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

/** A 2D context that accepts every call and remembers what was set on it. */
function stubCanvas() {
  const gradient = { addColorStop: () => undefined };
  const store: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(store, {
    get: (t, k) =>
      k in t ? t[k] : k === "createRadialGradient" || k === "createLinearGradient" ? () => gradient : () => undefined,
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ctx as unknown as CanvasRenderingContext2D,
  );
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
  const raf = vi.fn(() => 1);
  const caf = vi.fn();
  vi.stubGlobal("requestAnimationFrame", raf);
  vi.stubGlobal("cancelAnimationFrame", caf);
  vi.stubGlobal("IntersectionObserver", OnScreen);
  return { raf, caf };
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

  it("server-renders a finished still — land, pins and names — so first paint is never empty", () => {
    const html = renderToStaticMarkup(band());
    const doc = new DOMParser().parseFromString(html, "text/html");
    const stage = doc.querySelector(".mk-globe__stage")!;
    expect(stage.getAttribute("data-globe")).toBe("still");
    expect(stage.querySelectorAll("svg .mk-globe__land").length).toBeGreaterThan(4);
    expect(stage.querySelectorAll(".mk-map__pin")).toHaveLength(MAYA_CITIES.length);
    expect([...stage.querySelectorAll(".mk-globe__name")].map((n) => n.textContent)).toEqual(
      MAYA_CITIES.map((c) => c.city),
    );
    // No city is singled out before a script decides one is facing the reader.
    expect(doc.querySelectorAll(".mk-map__place[data-active]")).toHaveLength(0);
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

  it("never starts a loop under prefers-reduced-motion — one still, every city named, none lit", () => {
    stubCanvas();
    stubMotion({ reduce: true });
    const { raf } = stubFrames();
    const { container } = renderWithProviders(band());

    expect(raf).not.toHaveBeenCalled();
    expect(container.querySelector(".mk-globe")).not.toHaveAttribute("data-globe-motion");
    expect(container.querySelectorAll(".mk-map__place[data-active]")).toHaveLength(0);
    for (const name of container.querySelectorAll<HTMLElement>(".mk-globe__name")) {
      expect(name.style.opacity, name.textContent ?? "").toBe("1");
    }
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

  it("is decorative: the stage is hidden from assistive tech and nothing is announced", () => {
    const { container } = renderWithProviders(band());
    expect(container.querySelector(".mk-globe__stage")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("[aria-live]")).toBeNull();
    const list = container.querySelector(".mk-map__legend")!;
    expect(list.closest("[aria-hidden]")).toBeNull();
  });
});

describe("the globe — its cities come from the fixture", () => {
  it("lists and pins MAYA_CITIES in order, and types no city into the island", () => {
    const { container } = renderWithProviders(band());
    const places = [...container.querySelectorAll(".mk-map__place")];
    expect(places.map((p) => p.getAttribute("data-city"))).toEqual(MAYA_CITIES.map((c) => c.id));
    MAYA_CITIES.forEach((city, i) => {
      expect(places[i]!.textContent).toContain(city.phone);
      expect(places[i]!.textContent).toContain(city.address);
    });
    for (const file of ["components/marketing/world-globe.tsx", "components/marketing/world-map.tsx", "components/marketing/globe-geometry.ts"]) {
      for (const city of MAYA_CITIES) {
        expect(code(file), `${file} types "${city.city}"`).not.toContain(`"${city.city}"`);
      }
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

  it("composes the still with every city on the near side, and its names inside the disc", () => {
    const m = viewMatrix(GLOBE_STILL_LON);
    for (const city of MAYA_CITIES) {
      const p = project(m, latLonVector(city.lat, city.lon));
      expect(p.z, city.city).toBeGreaterThan(0.1);
      // A name near either limb slides inward rather than past the sphere's edge.
      if (Math.abs(p.x) > 0.8) expect(Math.sign(labelShift(p.x) + 50)).toBe(-Math.sign(p.x));
    }
  });

  it("lights at most one city at a time, each once per turn, in the order they come round", () => {
    const seen: number[] = [];
    let active = -1;
    for (let turned = 0; turned < 360; turned += 0.25) {
      const lon = wrapDeg(GLOBE_STILL_LON - turned);
      const m = viewMatrix(lon);
      const depths = MAYA_CITIES.map((c) => project(m, latLonVector(c.lat, c.lon)).z);
      active = facingCity(MAYA_CITIES, depths, lon, active);
      if (active >= 0 && seen[seen.length - 1] !== active) seen.push(active);
    }
    // Each city exactly once (the list may wrap once round the start).
    const once = seen[0] === seen[seen.length - 1] ? seen.slice(1) : seen;
    expect([...once].sort()).toEqual(MAYA_CITIES.map((_, i) => i));
    // West to east turning brings them round in falling longitude, cyclically.
    const byLon = MAYA_CITIES.map((c, i) => ({ i, lon: c.lon })).sort((a, b) => b.lon - a.lon).map((c) => c.i);
    const start = byLon.indexOf(once[0]!);
    expect(once).toEqual([...byLon.slice(start), ...byLon.slice(0, start)]);
  });
});
