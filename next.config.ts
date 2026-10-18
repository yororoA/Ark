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
    '127.0.0.1',
    "*.trycloudflare.com",
    "*.ngrok-free.app"
  ]
};

export default nextConfig;
