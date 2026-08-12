import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["src/**/*.live.test.ts", "node_modules"],
    clearMocks: true,
    restoreMocks: true,
  },
});
