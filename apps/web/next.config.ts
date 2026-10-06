import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compile the workspace packages (they ship TypeScript source, not built JS).
  transpilePackages: ["@repo/types", "@repo/utils"],
  // Allow ngrok tunnels for local iPhone testing. Safe — dev only, not shipped.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.io", "7ea0-49-204-190-142.ngrok-free.app"],
};

export default nextConfig;
