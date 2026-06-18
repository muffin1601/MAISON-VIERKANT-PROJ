import { NextResponse } from "next/server";
import { getProducts } from "@/services/catalogue/catalogue";

export const dynamic = "force-dynamic";

/** Slim search index for the storefront search overlay (instant client-side filtering). */
export async function GET() {
  const products = await getProducts();
  const index = products.map((p) => ({
    slug: p.slug,
    name: p.name,
    series: p.series,
    img: p.imgs[0] ?? "",
  }));
  const series = [...new Set(products.map((p) => p.series))].sort();
  return NextResponse.json(
    { products: index, series },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } },
  );
}
