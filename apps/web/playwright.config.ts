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

export default defineConfig({
  testDir: "./tests/e2e",
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
  webServer: {
    command: `pnpm exec next build && pnpm exec next start --port ${PORT}`,
    // `port`, not `url`: Playwright's url probe treats 404 as "not ready", and `/`
    // legitimately 404s until the marketing page (T26) lands. Waiting on the port
    // accepting connections is route-independent and cannot be broken by build order.
    port: PORT,
    timeout: 240_000,
    reuseExistingServer: true,
  },
});
