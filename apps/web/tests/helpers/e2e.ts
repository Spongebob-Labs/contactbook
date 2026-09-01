import type { Locator, Page, Response } from "@playwright/test";

/**
 * Every flake mitigation this run depends on lives here, applied in one place so no suite
 * can forget one (spec §14.6, §16.1 R-2 and R-10):
 *
 *  - `deviceScaleFactor: 2` — set per project in `playwright.config.ts`.
 *  - `animations: 'disabled'` — baked into {@link SCREENSHOT_OPTIONS}.
 *  - `await document.fonts.ready` before *any* geometry, contrast or screenshot assertion.
 *  - the **streamed-reveal settle** — see {@link waitForStreamedReveal} (D14). Folded into
 *    {@link gotoReady} so no spec has to remember it and none can opt out by accident.
 */

export const VIEWPORTS = [360, 768, 1440] as const;
export type Viewport = (typeof VIEWPORTS)[number];

export const VIEWPORT_SIZES: Record<Viewport, { width: number; height: number }> = {
  360: { width: 360, height: 800 },
  768: { width: 768, height: 1024 },
  1440: { width: 1440, height: 900 },
};

/** Playwright project name → viewport width. Mirrors `playwright.config.ts`. */
export const PROJECT_VIEWPORT: Record<string, Viewport> = {
  "vp-360": 360,
  "vp-768": 768,
  "vp-1440": 1440,
};

/** The screenshot options every pixel assertion in this run must use. */
export const SCREENSHOT_OPTIONS = {
  animations: "disabled",
  caret: "hide",
  scale: "device",
} as const;

const ANIMATION_KILL_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
}
html { scroll-behavior: auto !important; }
`;

/**
 * Zero every duration in the page. Token-agnostic on purpose: it overrides the *computed*
 * transition/animation, whatever `tokens.css` names its five duration tokens.
 *
 * `addStyleTag` does not survive a full navigation — {@link gotoReady} re-applies it.
 */
export async function disableAnimations(page: Page): Promise<void> {
  await page.addStyleTag({ content: ANIMATION_KILL_CSS });
}

/** Block until every webfont has loaded. The #1 cure for flaky layout tests (R-10). */
export async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

/**
 * Wait for React 19's **streamed reveal** to finish, so every CSS locator on the page is
 * unambiguous (spec §16.1, D14).
 *
 * §6.1 R-12/R-18 require a `loading.tsx` on every app route, a `loading.tsx` **is** a Suspense
 * boundary, and the pages are `async` — so the shell flushes first and each segment arrives
 * later in the stream. React 19 delivers that late segment inside `<div hidden id="S:n">`
 * appended to `<body>`, then reveals it on a **throttle**: `$RC` only queues the pair on `$RB`
 * and schedules `$RV` for `$RT + 300 ms`, where `$RT` is the first animation frame after the
 * shell painted. Until `$RV` runs, the hydrated copy is already in `<main>` **and** the streamed
 * copy is still attached to `<body>`.
 *
 * `waitUntil: 'load'` fires on the shell, *inside* that ~300 ms window on a warm production
 * server. Everything that does not auto-retry is exposed: strict-mode `click`, `evaluate`,
 * `dispatchEvent`, `boundingBox` and `innerText` throw immediately and are never retried, while
 * `count()` and `evaluateAll()` silently return doubled sets. That per-navigation coin flip is
 * why three runs of one unchanged build produced 8, 15 and 14 failures with near-disjoint sets.
 *
 * **This filters nothing out.** A duplicate that is genuinely the product's fault lives inside
 * `<main>`, survives this wait, and still fails strict mode. A page that never streamed matches
 * nothing, so the predicate is already true on the first evaluation and the wait is free.
 */
export async function waitForStreamedReveal(
  page: Page,
  options: { timeout?: number } = {},
): Promise<void> {
  await page.waitForFunction(
    () => document.querySelectorAll('body > div[hidden][id^="S:"]').length === 0,
    undefined,
    { timeout: options.timeout },
  );
}

export interface GotoReadyOptions {
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  timeout?: number;
}

/**
 * Navigate, kill animations, wait out the streamed reveal, and wait for fonts. Use this instead
 * of `page.goto` everywhere.
 *
 * Order matters, and all three steps are load-bearing:
 *  1. {@link disableAnimations} first, so anything the reveal inserts is already inert — the
 *     style tag carries `!important` and lands in `<head>`, so it governs late DOM too.
 *  2. {@link waitForStreamedReveal}, so no caller can address a doubled DOM (D14).
 *  3. {@link waitForFonts} last: the revealed segment may pull webfonts the shell never
 *     referenced, and `document.fonts.ready` must settle *after* that markup exists (R-10).
 *
 * Steps 1 and 3 are the R-2 mitigations `jsqr` decoding depends on — do not reorder them.
 */
export async function gotoReady(
  page: Page,
  url: string,
  options: GotoReadyOptions = {},
): Promise<Response | null> {
  const response = await page.goto(url, {
    waitUntil: options.waitUntil ?? "load",
    timeout: options.timeout,
  });
  await disableAnimations(page);
  await waitForStreamedReveal(page, { timeout: options.timeout });
  await waitForFonts(page);
  return response;
}

/**
 * Screenshot one element as a raw PNG buffer, fonts settled and animations dead.
 * This is the buffer `decodeQrPng` expects — do not re-encode it.
 */
export async function screenshotElement(
  locator: Locator,
  options: { timeout?: number } = {},
): Promise<Buffer> {
  const page = locator.page();
  await disableAnimations(page);
  await waitForFonts(page);
  await locator.waitFor({ state: "visible", timeout: options.timeout });
  return locator.screenshot({ ...SCREENSHOT_OPTIONS, timeout: options.timeout });
}

/** Screenshot the viewport (or the full page) as a raw PNG buffer. */
export async function screenshotPage(
  page: Page,
  options: { fullPage?: boolean; timeout?: number } = {},
): Promise<Buffer> {
  await disableAnimations(page);
  await waitForFonts(page);
  return page.screenshot({
    ...SCREENSHOT_OPTIONS,
    fullPage: options.fullPage ?? false,
    timeout: options.timeout,
  });
}

/** The element's box in CSS pixels. Throws rather than returning null, so callers stay terse. */
export async function boxOf(locator: Locator): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  await locator.waitFor({ state: "visible" });
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error("boxOf: element has no bounding box (is it display:none?)");
  }
  return box;
}

/** Do two boxes overlap at all? The primitive behind QR-T3 (spec §8A.7). */
export function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  );
}
