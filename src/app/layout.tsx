import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const viewport: Viewport = {
  themeColor: "#16110e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  applicationName: "Mazaj",
  title: "Mazaj · Hookah Ordering",
  description:
    "Order hookah from Egyptian-market molasses brands — Mazaya, Al Fakher, Dandash, Nakhla, Amy, Salom & Kass. 20g bowls, 2-for-1 when you bring your own. Install the app: full version, works offline, two-way synced.",
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
    title: "Mazaj · Hookah Ordering",
    description: "Egyptian-market hookah & molasses ordering.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
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
