import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Heavy CJS/native-ish libs used by the PDF-import route. Keep them out of the webpack
  // server bundle (they break interop when bundled — "Object.defineProperty on non-object")
  // and require them at runtime from node_modules instead. NOTE: pdfjs-dist must NOT be listed
  // here — it is imported client-side in renderPdfPages.ts and needs to be bundled there;
  // pdf-parse still resolves pdfjs-dist at runtime on the server on its own.
  serverExternalPackages: ["pdf-parse", "tesseract.js"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "wsrv.nl" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
