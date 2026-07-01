import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { Providers } from "./providers";
// @ts-ignore: CSS module typings are not available in this environment.
import "../styles/prototype.css";
// @ts-ignore: SCSS module typings are not available in this environment.
import "./globals.scss";

// Self-hosted via next/font — eliminates the render-blocking Google <link> and
// the associated CLS, while preserving the EXACT prototype typefaces. Exposed as
// CSS variables that prototype.css now references (with the literal name as fallback).
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const jost = Jost({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500"],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  title: {
    default: "Maison Vierkant India — Curated by Watcon",
    template: "%s · Maison Vierkant India",
  },
  description:
    "Handmade Atelier Vierkant clay vessels for India — planters, bowls, columns and seating across 38 series.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Maison Vierkant India",
    description: "Handmade Atelier Vierkant clay vessels, curated for India by Watcon.",
    type: "website",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "Maison Vierkant India" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Maison Vierkant India",
    description: "Handmade Atelier Vierkant clay vessels, curated for India by Watcon.",
    images: ["/og-image.svg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${jost.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
