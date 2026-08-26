import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Unit + contract runner. Playwright owns everything under `tests/e2e/` — the two
 * runners both define `describe`/`expect`, so the include/exclude globs below are
 * what keeps them from colliding.
 *
 * happy-dom has no layout engine: never assert geometry here (spec §14.6).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `next/font/google` is a compile-time API with no runtime implementation — see the
      // stub's own header. Without this alias, every test that renders a layout which loads a
      // typeface fails at import with "X is not a function".
      "next/font/google": fileURLToPath(
        new URL("./tests/stubs/next-font-google.ts", import.meta.url),
      ),
      // `server-only` is a build-time guard with no runtime module — see the stub's header.
      // Without this, any test that transitively imports the API client fails to resolve it.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/contract/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
  },
});
