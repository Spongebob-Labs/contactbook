import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Production live smoke against api.getcontactbook.com.
 *
 * Env:
 *   LIVE_ACCESS_TOKEN — Bearer for protected GET smokes (skip protected if unset)
 *   LIVE_ALLOW_MUTATIONS=1 — allow mutating probes (default: off)
 *   VITE_API_URL — defaults to https://api.getcontactbook.com/api
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@repo/types": fileURLToPath(
        new URL("../../packages/types/index.ts", import.meta.url),
      ),
      "@repo/utils": fileURLToPath(
        new URL("../../packages/utils/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.live.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
