import type { Metadata, Viewport } from "next";
// r60: fonts are SELF-HOSTED (next/font/local). The previous
// next/font/google setup fetched Google Fonts at build time, which made
// Vercel builds flaky ("next/font/google queries have exactly one entry"
// when fonts.gstatic.com rate-limits the build IP — took down the r60
// restore deploy). Local files = deterministic builds, faster cold starts.
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "sonner";
import { I18nProvider } from "@/components/hookah/i18n-provider";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

// Cinematic display serif for the landing — per-glyph fallback:
// Latin glyphs render in Playfair, Arabic glyphs fall through to Amiri.
// (Playfair latin variable woff2 covers weights 500–900, normal + italic.)
const playfair = localFont({
  src: [
    { path: "./fonts/playfair-display-latin.woff2", weight: "500 900", style: "normal" },
    { path: "./fonts/playfair-display-italic-latin.woff2", weight: "500 900", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
});

const amiri = localFont({
  src: [
    { path: "./fonts/amiri-arabic.woff2", weight: "400", style: "normal" },
    { path: "./fonts/amiri-arabic-bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-display-ar",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#16110e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  applicationName: "Mazaj",
  title: "Mazaj · Where Smoke Becomes Poetry",
  description:
    "Seven legendary molasses houses. Bowls crafted to order, tracked live to your table. Install the full app — no app store, works offline, two-way synced with the lounge.",
  keywords: [
    "hookah",
    "shisha",
    "molasses",
    "Mazaya",
    "Al Fakher",
    "Dandash",
    "Nakhla",
    "Amy",
    "Salom",
    "Kass",
    "Egypt",
    "ordering",
  ],
  authors: [{ name: "Mazaj Lounge" }],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mazaj",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Mazaj · Where Smoke Becomes Poetry",
    description:
      "The cinematic shisha atelier — order, track live, earn rewards. Full app installs without an app store.",
    siteName: "Mazaj",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${amiri.variable} antialiased bg-background text-foreground`}
      >
        <I18nProvider>
          {children}
        </I18nProvider>
        <Toaster
          theme="dark"
          richColors
          position="top-center"
          duration={2600}
          toastOptions={{
            style: {
              borderRadius: "0.75rem",
            },
          }}
        />
      </body>
    </html>
  );
}
