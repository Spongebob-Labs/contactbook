import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compile the workspace packages (they ship TypeScript source, not built JS).
  transpilePackages: ["@repo/types", "@repo/utils"],
};

export default nextConfig;
