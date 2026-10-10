import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display, Amiri } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { I18nProvider } from "@/components/hookah/i18n-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Cinematic display serif for the landing — per-glyph fallback:
// Latin glyphs render in Playfair, Arabic glyphs fall through to Amiri.
const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

const amiri = Amiri({
  variable: "--font-display-ar",
  subsets: ["arabic"],
  weight: ["400", "700"],
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
