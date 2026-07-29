import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
