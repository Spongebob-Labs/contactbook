import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toBlob } from "html-to-image";

import { CARD_DESIGN_HEIGHT, CARD_DESIGN_WIDTH } from "@/card/share-face";
import type { PaletteId } from "@/card/template-palettes";
import { MIN_QR_SIZE_PX, qrSizePx } from "@/card/qr-geometry";
import { isExportFailedError } from "@/card/errors";
import {
  CARD_EXPORT_HEIGHT,
  CARD_EXPORT_WIDTH,
  DEFAULT_EXPORT_PIXEL_RATIO,
  EXPORT_MIME_TYPE,
  exportCardPng,
  exportFileName,
  exportPixelSize,
  isExportBusyError,
  isExportInFlight,
} from "@/card/export-card-png";
import { resolveCard } from "@/card/resolve-card";
import { TEMPLATES } from "@/card/templates";
import type { TemplateId } from "@/card/template-types";
import { cardLedgerDemo } from "@/fixtures/cards";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import { fixtureUser } from "@/fixtures/user";
import type { ContactCard, ResolvedCard } from "@/types/domain";

/**
 * `exportCardPng` — spec §6.8, §9.4, §11 E-43/E-44; plan T15.
 *
 * ⚠ **This file proves the export *path*, never the exported *pixels*.** happy-dom has no
 * layout engine, no canvas and no rasteriser, so `html-to-image` is mocked at the module
 * boundary. The ground-truth assertion — a 672 × 1000 PNG that `jsqr` decodes to exactly
 * `resolved.qrPayload` — lives in the Playwright suite, in a real browser.
 *
 * What a mocked rasteriser can still see is everything that decides whether that decode is
 * even possible:
 *
 *  - the node handed over is the card root pinned to the **336 × 500 face** at `pixelRatio` 2,
 *    so the symbol clears the 140 CSS px floor and lands at 280+ device px in the file;
 *  - the node is **attached to the document** at that moment. A detached node has no
 *    stylesheet in scope and rasterises to an empty PNG — a failure with no DOM symptom and a
 *    dead card;
 *  - the offscreen host is off-screen by position, never by `display` or `visibility`,
 *    because an unrendered node rasterises to nothing;
 *  - fonts are settled **after** the mount and **before** the raster;
 *  - the busy flag always clears (E-44) and a second call in flight rasterises nothing (E-43).
 */

vi.mock("html-to-image", () => ({ toBlob: vi.fn() }));

const rasterise = vi.mocked(toBlob);

/** `html-to-image` declares its options type but does not export it from the entry point. */
type RasteriseOptions = NonNullable<Parameters<typeof toBlob>[1]>;

/* ── fixtures ───────────────────────────────────────────────────────────────── */

const ALL_TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

function cardOn(templateId: TemplateId): ContactCard {
  return { ...cardLedgerDemo, id: `card_t15_${templateId}`, templateId };
}

function resolve(card: ContactCard = cardLedgerDemo): ResolvedCard {
  return resolveCard(card, fixtureUser, fixtureGroups, fixtureFields);
}

const LEDGER = resolve();

/** Four PNG signature bytes. Enough to be a real `Blob`; the pixels are T27's problem. */
function pngBlob(): Blob {
  return new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: EXPORT_MIME_TYPE });
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolveFn: (value: T) => void = () => undefined;
  let rejectFn: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  return { promise, resolve: resolveFn, reject: rejectFn };
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  );
}

/* ── what the rasteriser saw, captured at the moment it was called ───────────── */

interface RasteriseCall {
  node: HTMLElement;
  options: RasteriseOptions;
  /** ⚠ The one that matters: was the export node in the document when handed over? */
  nodeAttached: boolean;
  hostAttached: boolean;
  hostDisplay: string;
  hostVisibility: string;
  hostPosition: string;
  hostLeft: string;
  hostWidth: string;
  hostHeight: string;
  hostCount: number;
}

let calls: RasteriseCall[];
let events: string[];
let hostSelector: string;
let decodeCalls: number;

function record(node: HTMLElement, options: RasteriseOptions | undefined): void {
  const host = node.closest<HTMLElement>(hostSelector);
  events.push("raster");
  calls.push({
    node,
    options: options ?? {},
    nodeAttached: document.body.contains(node),
    hostAttached: host !== null && document.body.contains(host),
    hostDisplay: host?.style.display ?? "",
    hostVisibility: host?.style.visibility ?? "",
    hostPosition: host?.style.position ?? "",
    hostLeft: host?.style.left ?? "",
    hostWidth: host?.style.width ?? "",
    hostHeight: host?.style.height ?? "",
    hostCount: document.querySelectorAll(hostSelector).length,
  });
}

function onlyCall(): RasteriseCall {
  expect(calls).toHaveLength(1);
  return calls[0];
}

/* ── the Font Loading API stub (happy-dom has none) ─────────────────────────── */

let fontStatus: string;
let fontReady: () => Promise<unknown>;
let fontsReadWhileAttached: boolean | null;

const FONTS_STUB = {
  get status(): string {
    return fontStatus;
  },
  get ready(): Promise<unknown> {
    events.push("fonts");
    fontsReadWhileAttached = document.querySelector("[data-card-root]") !== null;
    return fontReady();
  },
};

function installFonts(): void {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    get: () => FONTS_STUB as unknown as FontFaceSet,
  });
}

function removeFonts(): void {
  Reflect.deleteProperty(document, "fonts");
}

beforeEach(() => {
  hostSelector = "[data-card-export-host]";
  calls = [];
  events = [];
  decodeCalls = 0;
  fontStatus = "loaded";
  fontReady = () => Promise.resolve();
  fontsReadWhileAttached = null;
  rasterise.mockReset();
  rasterise.mockImplementation(async (node, options) => {
    record(node, options);
    return pngBlob();
  });
  installFonts();
  vi.spyOn(HTMLImageElement.prototype, "decode").mockImplementation(async () => {
    decodeCalls += 1;
    events.push("image");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  removeFonts();
  // E-44 restated as a suite-wide invariant: no export, however it ended, may leave the
  // offscreen host or its card behind in the document.
  expect(document.querySelectorAll(hostSelector)).toHaveLength(0);
  expect(isExportInFlight()).toBe(false);
});

/* ── the contract ───────────────────────────────────────────────────────────── */

describe("exportCardPng — the §6.8 contract", () => {
  it("resolves to an image/png Blob and rasterises exactly once", async () => {
    const blob = await exportCardPng(LEDGER);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(EXPORT_MIME_TYPE).toBe("image/png");
    expect(rasterise).toHaveBeenCalledTimes(1);
  });

  it("pins the offscreen node to the 336 × 500 face", async () => {
    await exportCardPng(LEDGER);
    const call = onlyCall();

    /* One canvas for every template. This was briefly a per-layout lookup, back when one
       composition was landscape; dropping that composition dropped the need, and it is what
       lets a single raster size serve a wallet pass, a print and a share sheet. */
    expect(CARD_EXPORT_WIDTH).toBe(CARD_DESIGN_WIDTH);
    expect(CARD_EXPORT_HEIGHT).toBe(CARD_DESIGN_HEIGHT);
    expect(CARD_EXPORT_WIDTH).toBe(336);
    expect(CARD_EXPORT_HEIGHT).toBe(500);
    expect(call.options.width).toBe(336);
    expect(call.options.height).toBe(500);
    expect(call.options.type).toBe("image/png");
  });

  it("defaults pixelRatio to 2, so the 672 × 1000 raster carries the symbol at 2×", async () => {
    await exportCardPng(LEDGER);

    expect(DEFAULT_EXPORT_PIXEL_RATIO).toBe(2);
    expect(onlyCall().options.pixelRatio).toBe(2);
    expect(exportPixelSize()).toEqual({ width: 672, height: 1000 });
  });

  it("honours an explicit pixelRatio of 3", async () => {
    await exportCardPng(LEDGER, { pixelRatio: 3 });

    expect(onlyCall().options.pixelRatio).toBe(3);
    expect(exportPixelSize(3)).toEqual({ width: 1008, height: 1500 });
  });

  it("names the file contact-book-{slug}.png", () => {
    expect(exportFileName(LEDGER)).toBe("contact-book-prya-hq.png");
    expect(exportFileName({ ...LEDGER, slug: "acme-sales" })).toBe(
      "contact-book-acme-sales.png",
    );
  });
});

describe("the offscreen node — ⚠ attached, or the QR lands in the wrong grid track", () => {
  it("hands the rasteriser a [data-card-root] that is IN the document", async () => {
    await exportCardPng(LEDGER);
    const call = onlyCall();

    expect(call.node.hasAttribute("data-card-root")).toBe(true);
    expect(call.nodeAttached).toBe(true);
    expect(call.hostAttached).toBe(true);
    expect(call.hostCount).toBe(1);
  });

  it("hides the host by position only — never display:none or visibility:hidden", async () => {
    await exportCardPng(LEDGER);
    const call = onlyCall();

    // An unrendered node rasterises to an empty PNG, which is the silent version of this bug.
    expect(call.hostDisplay).not.toBe("none");
    expect(call.hostVisibility).not.toBe("hidden");
    expect(call.hostWidth).toBe("336px");
    expect(call.hostHeight).toBe("500px");

    // ...and off-screen it must genuinely be: an on-screen host flashes a second card over
    // the page for as long as the raster takes.
    expect(call.hostPosition).toBe("fixed");
    expect(Number.parseFloat(call.hostLeft)).toBeLessThanOrEqual(-CARD_EXPORT_WIDTH);
  });

  it("renders mode=export: one QR zone, a real symbol, no thumb placeholder", async () => {
    await exportCardPng(LEDGER);
    const { node } = onlyCall();

    expect(node.getAttribute("data-render-mode")).toBe("export");
    expect(node.querySelectorAll("[data-qr-zone]")).toHaveLength(1);
    expect(node.querySelectorAll("[data-qr-symbol]")).toHaveLength(1);
    expect(node.querySelectorAll("[data-qr-glyph]")).toHaveLength(0);
    expect(node.querySelector("[data-qr-zone]")?.getAttribute("data-qr-mode")).toBe("export");
    expect(node.querySelector("[data-qr-zone]")?.hasAttribute("data-qr-error")).toBe(false);
  });

  it("exports one real symbol from an attached node, for all eight templates", async () => {
    /* This replaced a test asserting each template's QR *grid row* utility class. That concept
       left with `QrZoneSpec.anchor`: the face no longer places the symbol on a shared grid,
       because `faceLayout` decides the composition and the QR has nothing to negotiate
       vertical space with. What still matters — and what the old test was really protecting —
       is that the node is ATTACHED when it rasterises. A detached node has no stylesheet, so
       it rasterises to an empty PNG, which is the silent version of this bug. */
    for (const id of ALL_TEMPLATE_IDS) {
      await exportCardPng(resolve(cardOn(id)));
    }

    expect(calls).toHaveLength(ALL_TEMPLATE_IDS.length);
    for (const [index, id] of ALL_TEMPLATE_IDS.entries()) {
      const { node, nodeAttached } = calls[index];
      expect(nodeAttached).toBe(true);
      expect(node.getAttribute("data-template-id")).toBe(id);
      expect(node.getAttribute("data-card-variant")).toBe("face");
      expect(node.querySelectorAll("[data-qr-zone]")).toHaveLength(1);
      expect(node.querySelectorAll("[data-qr-symbol]")).toHaveLength(1);
    }
  });

  it("keeps every template's exported symbol above the scannable floor", async () => {
    for (const id of ALL_TEMPLATE_IDS) {
      await exportCardPng(resolve(cardOn(id)));
    }

    for (const call of calls) {
      const zone = call.node.querySelector("[data-qr-zone]");
      const size = Number(zone?.getAttribute("data-qr-size"));
      const reserved = Number(zone?.getAttribute("data-qr-reserved"));
      /* The floor is the point of the whole QR contract: 140 CSS px is the smallest reliable
         arm's-length scan off a phone screen, and at the default ×2 that is 280 device px in
         the file. No composition and no template may talk it down. */
      expect(size).toBeGreaterThanOrEqual(MIN_QR_SIZE_PX);
      expect(size * DEFAULT_EXPORT_PIXEL_RATIO).toBeGreaterThanOrEqual(MIN_QR_SIZE_PX * 2);

      /* The plate plus both quiet zones still fits the canvas it is drawn on. */
      expect(reserved).toBeGreaterThan(size);
      expect(reserved).toBeLessThanOrEqual(CARD_EXPORT_WIDTH);
    }
  });

  it("removes the host and disconnects the card once the export resolves", async () => {
    await exportCardPng(LEDGER);
    const { node } = onlyCall();

    expect(document.querySelector("[data-card-export-host]")).toBeNull();
    expect(document.querySelector("[data-card-root]")).toBeNull();
    expect(node.isConnected).toBe(false);
  });
});

describe("fonts settle after the mount and before the raster (§6.8)", () => {
  it("awaits document.fonts.ready with the card already mounted", async () => {
    await exportCardPng(LEDGER);

    expect(fontsReadWhileAttached).toBe(true);
    // The avatar is a same-origin `<img>`, so every card settles one image first.
    expect(events).toEqual(["image", "fonts", "raster"]);
  });

  it("still exports where the Font Loading API does not exist", async () => {
    removeFonts();

    const blob = await exportCardPng(LEDGER);

    expect(blob.type).toBe("image/png");
    expect(events).toEqual(["image", "raster"]);
  });

  it("rejects font-not-loaded when fonts.ready rejects, and never rasterises", async () => {
    const cause = new Error("font loading aborted");
    fontReady = () => Promise.reject(cause);

    const error = await caught(exportCardPng(LEDGER));

    expect(isExportFailedError(error)).toBe(true);
    expect(isExportFailedError(error) ? error.reason : null).toBe("font-not-loaded");
    expect(isExportFailedError(error) ? error.cause : null).toBe(cause);
    expect(rasterise).not.toHaveBeenCalled();
  });

  it("rejects font-not-loaded when a face is still swapping after two settles", async () => {
    fontStatus = "loading";

    const error = await caught(exportCardPng(LEDGER));

    expect(isExportFailedError(error) ? error.reason : null).toBe("font-not-loaded");
    expect(rasterise).not.toHaveBeenCalled();
    // Two reads of `ready`: one settle, then one retry before giving up.
    expect(events.filter((event) => event === "fonts")).toHaveLength(2);
  });

  it("exports when a late face settles on the second read", async () => {
    const statuses = ["loading", "loaded"];
    fontReady = () => {
      fontStatus = statuses.shift() ?? "loaded";
      return Promise.resolve();
    };

    const blob = await exportCardPng(LEDGER);

    expect(blob.type).toBe("image/png");
    expect(events).toEqual(["image", "fonts", "fonts", "raster"]);
  });
});

describe("failure shapes (§6.8, §9.4, E-44)", () => {
  it("maps a SecurityError from the rasteriser to image-tainted", async () => {
    const cause = new Error("Tainted canvases may not be exported.");
    cause.name = "SecurityError";
    rasterise.mockRejectedValueOnce(cause);

    const error = await caught(exportCardPng(LEDGER));

    expect(isExportFailedError(error)).toBe(true);
    expect(isExportFailedError(error) ? error.reason : null).toBe("image-tainted");
    expect(isExportFailedError(error) ? error.cause : null).toBe(cause);
  });

  it("maps a cross-origin image failure to image-tainted", async () => {
    rasterise.mockRejectedValueOnce(new Error("cross-origin image could not be embedded"));

    const error = await caught(exportCardPng(LEDGER));

    expect(isExportFailedError(error) ? error.reason : null).toBe("image-tainted");
  });

  it("maps any other rasteriser throw to unknown", async () => {
    rasterise.mockRejectedValueOnce(new Error("canvas allocation failed"));

    const error = await caught(exportCardPng(LEDGER));

    expect(isExportFailedError(error) ? error.reason : null).toBe("unknown");
  });

  it("maps a non-Error throw to unknown rather than crashing the classifier", async () => {
    rasterise.mockRejectedValueOnce("nope");

    const error = await caught(exportCardPng(LEDGER));

    expect(isExportFailedError(error) ? error.reason : null).toBe("unknown");
  });

  it("rejects unknown when the rasteriser resolves null", async () => {
    rasterise.mockResolvedValueOnce(null);

    const error = await caught(exportCardPng(LEDGER));

    expect(isExportFailedError(error)).toBe(true);
    expect(isExportFailedError(error) ? error.reason : null).toBe("unknown");
  });

  it("maps a font-embedding failure from the rasteriser to font-not-loaded", async () => {
    rasterise.mockRejectedValueOnce(new Error("Error while embedding fonts"));

    const error = await caught(exportCardPng(LEDGER));

    expect(isExportFailedError(error) ? error.reason : null).toBe("font-not-loaded");
  });

  it("rejects unknown when the render produces no card root at all", async () => {
    // The branch under test is an empty host: the renderer threw, React discarded the tree,
    // and there is nothing to rasterise. It must reject rather than produce a PNG of nothing.
    //
    // The trigger has moved twice, and both moves are worth recording because each one made the
    // previous one inert:
    //
    //   1. originally an unknown TEMPLATE ID, back when the renderer looked the template up in
    //      the registry itself. `<ShareFace>` now receives the resolved template as an object,
    //      so a bad id is inert;
    //   2. then an unknown `template.paletteId`, back when the renderer looked the palette up.
    //      `resolveCard` now resolves the palette, so that is inert too.
    //
    // What the renderer still dereferences is `resolved.palette`, so removing it is the honest
    // way to reach the same branch — and it is a real failure mode, not a contrivance: a card
    // arriving from an API with a palette id the client does not know about resolves to exactly
    // this.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = {
      ...LEDGER,
      palette: undefined,
    } as unknown as ResolvedCard;

    const error = await caught(exportCardPng(broken));

    expect(isExportFailedError(error)).toBe(true);
    expect(isExportFailedError(error) ? error.reason : null).toBe("unknown");
    expect(rasterise).not.toHaveBeenCalled();
    expect(document.querySelector("[data-card-export-host]")).toBeNull();
  });

  it("converts a throw from outside the rasteriser into ExportFailedError too", async () => {
    // The rejection contract is closed: a caller never has to narrow on a raw DOM throw.
    const cause = new Error("could not attach the export host");
    vi.spyOn(document.body, "appendChild").mockImplementationOnce(() => {
      throw cause;
    });

    const error = await caught(exportCardPng(LEDGER));

    expect(isExportFailedError(error)).toBe(true);
    expect(isExportFailedError(error) ? error.reason : null).toBe("unknown");
    expect(isExportFailedError(error) ? error.cause : null).toBe(cause);
    expect(rasterise).not.toHaveBeenCalled();
  });

  it("clears the host and the busy flag after a failure, and the retry succeeds", async () => {
    rasterise.mockRejectedValueOnce(new Error("canvas allocation failed"));

    await caught(exportCardPng(LEDGER));

    expect(isExportInFlight()).toBe(false);
    expect(document.querySelector("[data-card-export-host]")).toBeNull();

    const blob = await exportCardPng(LEDGER);
    expect(blob.type).toBe("image/png");
    expect(rasterise).toHaveBeenCalledTimes(2);
  });
});

describe("E-43 — export tapped twice", () => {
  it("ignores the second call in flight: one raster, one blob, one host", async () => {
    const gate = deferred<Blob | null>();
    rasterise.mockImplementation(async (node, options) => {
      record(node, options);
      return gate.promise;
    });

    const first = exportCardPng(LEDGER);
    const second = exportCardPng(LEDGER);
    const error = await caught(second);

    expect(isExportInFlight()).toBe(true);
    expect(document.querySelectorAll("[data-card-export-host]")).toHaveLength(1);
    expect(isExportBusyError(error)).toBe(true);
    // A busy signal is not a failure: E-44's toast must not fire on a double tap.
    expect(isExportFailedError(error)).toBe(false);

    gate.resolve(pngBlob());
    const blob = await first;

    expect(blob.type).toBe("image/png");
    expect(rasterise).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(isExportInFlight()).toBe(false);
  });

  it("reports the busy state before, during and after the export", async () => {
    const gate = deferred<Blob | null>();
    rasterise.mockImplementation(async (node, options) => {
      record(node, options);
      return gate.promise;
    });

    expect(isExportInFlight()).toBe(false);
    const running = exportCardPng(LEDGER);
    expect(isExportInFlight()).toBe(true);

    gate.resolve(pngBlob());
    await running;

    expect(isExportInFlight()).toBe(false);
  });

  it("exports again once the first has settled", async () => {
    await exportCardPng(LEDGER);
    const second = await exportCardPng(LEDGER);

    expect(second.type).toBe("image/png");
    expect(rasterise).toHaveBeenCalledTimes(2);
  });
});

describe("same-origin media settles before the raster (§7.4, E-21)", () => {
  /** Foundry is `solid+photo-split`, so its ground is a real `<img>` from `/public`. */
  const FOUNDRY = resolve(cardOn("meridian"));

  it("awaits every image, then the fonts, then rasterises", async () => {
    await exportCardPng(FOUNDRY);
    const { node } = onlyCall();

    expect(node.querySelectorAll("img").length).toBeGreaterThan(0);
    expect(decodeCalls).toBe(node.querySelectorAll("img").length);
    expect(events).toEqual(["image", "fonts", "raster"]);
  });

  it("exports anyway when an image cannot decode — the renderer owns that fallback", async () => {
    vi.spyOn(HTMLImageElement.prototype, "decode").mockImplementation(async () => {
      decodeCalls += 1;
      events.push("image");
      throw new Error("404");
    });

    const blob = await exportCardPng(FOUNDRY);

    expect(blob.type).toBe("image/png");
    expect(decodeCalls).toBeGreaterThan(0);
    expect(events).toEqual(["image", "fonts", "raster"]);
  });
});
