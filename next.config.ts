import type { NextConfig } from "next";

/**
 * WEDJAT MAZAJ — hardened Next.js config (r62).
 *
 * Security posture:
 *  • poweredByHeader:false      — stop advertising the framework
 *  • nosniff / referrer / frame — standard hardening, zero app impact
 *  • Permissions-Policy         — camera stays enabled (barcode scan at the
 *                                 table); mic / geolocation / payment locked
 *  • HSTS                       — the platform is HTTPS-only (vercel.app)
 *
 * These headers apply to every route, including /api/*.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  poweredByHeader: false,
  // Allow the cloud-sandbox preview panel (and LAN) to load /_next/* dev assets.
  allowedDevOrigins: [
    "*.space-z.ai",
    "21.0.4.35",
    "localhost",
    "127.0.0.1",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
