import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";
import { getProducts } from "@/services/catalogue/catalogue";

export const dynamic = "force-dynamic";

/**
 * XML sitemap. Static marketing/legal pages plus one entry per product.
 * Product enumeration uses the same catalogue service as the storefront, so it
 * works in both DB and fallback mode and never throws (getProducts is guarded).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl.replace(/\/$/, "");

  const staticPaths = [
    "",
    "/collection",
    "/projects",
    "/about",
    "/contact",
    "/shipping",
    "/returns",
    "/privacy",
    "/terms",
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: `${base}${p}`,
    changeFrequency: p === "" || p === "/collection" ? "weekly" : "monthly",
    priority: p === "" ? 1 : p === "/collection" ? 0.9 : 0.5,
  }));

  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const products = await getProducts();
    productEntries = products.map((p) => ({
      url: `${base}/products/${p.slug}`,
      changeFrequency: "monthly",
      priority: 0.7,
    }));
  } catch {
    // Catalogue unavailable — still return the static sitemap.
  }

  return [...staticEntries, ...productEntries];
}
