import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mazaj · Hookah Ordering",
  description:
    "Order hookah from Egyptian-market molasses brands — Mazaya, Al Fakher, Dandash, Nakhla, Amy, Salom & Kass. 20g bowls, 2-for-1 when you bring your own.",
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
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
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
        {children}
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
