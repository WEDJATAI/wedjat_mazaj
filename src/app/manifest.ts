import type { MetadataRoute } from "next";

/**
 * PWA manifest — makes Mazaj installable on Android (native install
 * prompt), iOS (Add to Home Screen) and desktop Chrome/Edge.
 * The installed app IS the full platform: same data, same APIs,
 * two-way synced in real time.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mazaj — Hookah Lounge",
    short_name: "Mazaj",
    description:
      "Order premium hookah from Egyptian-market molasses brands — Mazaya, Al Fakher, Dandash, Nakhla, Amy, Salom & Kass. Live order tracking, Mazaj+ rewards, two-way synced with the lounge.",
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#16110e",
    theme_color: "#16110e",
    lang: "en",
    dir: "auto",
    categories: ["food", "lifestyle", "shopping"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Track my order",
        short_name: "Track",
        url: "/?source=pwa&track=1",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Order hookah",
        short_name: "Order",
        url: "/?source=pwa",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
