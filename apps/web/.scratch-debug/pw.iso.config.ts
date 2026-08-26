/* TEMPORARY — an isolated Playwright config so this track can run the suite against its own
   server on :3320 instead of building over the shared `.next` at :3100. Delete with the rest
   of `.scratch-debug`. */
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const BASE_URL = "http://localhost:3320";

export default defineConfig({
  testDir: path.resolve(__dirname, "../tests/e2e"),
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  reporter: [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: { baseURL: BASE_URL, trace: "off" },
  projects: [
    { name: "vp-360", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 }, deviceScaleFactor: 2 } },
    { name: "vp-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2 } },
    { name: "vp-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } },
  ],
});
