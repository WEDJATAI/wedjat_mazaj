import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the cloud-sandbox preview panel (and LAN) to load /_next/* dev assets.
  allowedDevOrigins: [
    "*.space-z.ai",
    "21.0.4.35",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
