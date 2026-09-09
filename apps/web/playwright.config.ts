import { defineConfig, devices } from "@playwright/test";

/**
 * Real-browser suite: geometry, QR scannability, contrast and a11y (spec §14.1).
 *
 * `testDir` is scoped to `tests/e2e` on purpose — Vitest and Playwright both export
 * `expect`/`describe`, and letting Playwright pick up `tests/unit/**` produces a
 * "Vitest cannot be imported in a CommonJS module" error that looks like a product bug.
 *
 * Every project runs Chromium at `deviceScaleFactor: 2`. That is not cosmetic: `jsqr`
 * decoding a 1x screenshot is the documented flake source (spec §16.1 R-2).
 */
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * The stub API (`tests/stubs/api.mjs`).
 *
 * ⚠ It now serves the **authenticated** surface as well as `/c/{token}`, and that widening is
 * what un-blocks the `(app)` suites. `/c/[slug]` and every `(app)` screen resolve server-side,
 * so `page.route()` cannot reach either — without a stub the public route was untestable (how
 * the ground regression shipped unseen) and, after the API migration, so was every gated
 * screen: `(app)/layout.tsx` got a 404 for `GET /profile/me`, and `proxy.ts` bounced the
 * navigation to `/signin/phone`. `card-detail.spec.ts` and `builder.spec.ts` were asserting
 * against a phone-number form.
 *
 * Its data comes from `src/fixtures` via `tests/global-setup.ts` — one source of truth. Reads
 * are real; writes are accepted and not persisted. See the stub's own header.
 */
const STUB_API_PORT = 8788;

export default defineConfig({
  testDir: "./tests/e2e",
  /**
   * Writes the fixture snapshot the API stub serves.
   *
   * Here rather than inside the stub because Playwright transpiles this config and its setup
   * (resolving the `@/` alias), while the stub is a plain-Node process and this workspace has
   * no TypeScript runner for it.
   */
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "vp-360",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 2,
      },
    },
    {
      name: "vp-768",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 2,
      },
    },
    {
      name: "vp-1440",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      },
    },
  ],
  // Production build, not `next dev`: dev-mode HMR and on-demand compilation perturb
  // both layout timing and the raster jsqr reads. Server startup sits outside the
  // 10-minute suite budget (N-7), hence the generous timeout.
  webServer: [
    {
      command: `node tests/stubs/api.mjs`,
      port: STUB_API_PORT,
      env: { STUB_API_PORT: String(STUB_API_PORT) },
      timeout: 30_000,
      reuseExistingServer: true,
    },
    {
      command: `pnpm exec next build && pnpm exec next start --port ${PORT}`,
      // Points the Next server's server-side card fetch at the stub above.
      env: { API_BASE_URL: `http://localhost:${STUB_API_PORT}` },
    // `port`, not `url`: Playwright's url probe treats 404 as "not ready", and `/`
    // legitimately 404s until the marketing page (T26) lands. Waiting on the port
    // accepting connections is route-independent and cannot be broken by build order.
      port: PORT,
      timeout: 240_000,
      reuseExistingServer: true,
    },
  ],
});
