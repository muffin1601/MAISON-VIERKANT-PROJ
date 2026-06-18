import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug, getProducts, getActivePricing } from "@/services/catalogue/catalogue";
import { ProductDetail } from "@/features/catalogue/ProductDetail";
import { toCardData } from "@/features/catalogue/cardData";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Not found" };
  return {
    title: `${p.name} — ${p.series}`,
    description: p.desc,
    openGraph: { images: p.imgs[0] ? [p.imgs[0]] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, products, pricing] = await Promise.all([
    getProductBySlug(slug),
    getProducts(),
    getActivePricing(),
  ]);
  if (!p) notFound();

  const all = toCardData(products, pricing);
  // Related = same series first, then fill from the rest of the catalogue.
  const sameSeries = all.filter((c) => c.series === p.series && c.slug !== p.slug);
  const others = all.filter((c) => c.series !== p.series && c.slug !== p.slug);
  const related = [...sameSeries, ...others].slice(0, 4);

  return <ProductDetail p={p} pricing={pricing} related={related} all={all} />;
}
