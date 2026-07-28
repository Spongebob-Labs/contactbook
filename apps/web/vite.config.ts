import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_PROXY_TARGET =
  process.env.VITE_API_PROXY_TARGET ?? "http://34.147.177.94:8080";

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
  server: {
    proxy: {
      "/api": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    proxy: {
      "/api": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
