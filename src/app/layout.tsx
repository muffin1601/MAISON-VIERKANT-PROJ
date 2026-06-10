import type { Metadata } from "next";
import { Providers } from "./providers";
import "@/styles/prototype.css";
import "./globals.scss";

export const metadata: Metadata = {
  title: {
    default: "Maison Vierkant India — Curated by Watcon",
    template: "%s · Maison Vierkant India",
  },
  description:
    "Handmade Atelier Vierkant clay vessels for India — planters, bowls, columns and seating across 38 series.",
  openGraph: {
    title: "Maison Vierkant India",
    description: "Handmade Atelier Vierkant clay vessels, curated for India by Watcon.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Exact prototype fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@200;300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
