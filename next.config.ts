import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal Node runtime for the self-hosted Docker image.
  output: "standalone",
  images: {
    unoptimized: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
