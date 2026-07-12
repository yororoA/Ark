import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  allowedDevOrigins:[
    "*.trycloudflare.com",
  ]
};

export default nextConfig;
