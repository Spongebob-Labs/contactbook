import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/** Live ContactBook API origin (paths are /api/v1/...). */
const LIVE_API_ORIGIN = "https://api.getcontactbook.com";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "");
  const API_PROXY_TARGET = env.VITE_API_PROXY_TARGET || LIVE_API_ORIGIN;

  return {
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
        // Browser: /api/v1/auth/otp/whatsapp/send
        // Upstream: https://api.getcontactbook.com/api/v1/auth/otp/whatsapp/send
        "/api": {
          target: API_PROXY_TARGET,
          changeOrigin: true,
          secure: true,
          cookieDomainRewrite: "",
        },
      },
    },
    preview: {
      proxy: {
        "/api": {
          target: API_PROXY_TARGET,
          changeOrigin: true,
          secure: true,
          cookieDomainRewrite: "",
        },
      },
    },
  };
});
