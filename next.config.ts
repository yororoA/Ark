import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
    turbopackFileSystemCacheForDev: false,
  },
  allowedDevOrigins:[
    "*.trycloudflare.com",
    "*.ngrok-free.app"
  ]
};

export default nextConfig;
