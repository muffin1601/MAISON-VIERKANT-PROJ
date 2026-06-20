import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

/** robots.txt — allow the public storefront, keep admin/account/api private. */
export default function robots(): MetadataRoute.Robots {
  const base = appUrl.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/api/", "/checkout", "/cart"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
