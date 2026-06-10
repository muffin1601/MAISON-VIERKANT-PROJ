import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug, getActivePricing } from "@/services/catalogue/catalogue";
import { ProductDetail } from "@/features/catalogue/ProductDetail";

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
  const [p, pricing] = await Promise.all([getProductBySlug(slug), getActivePricing()]);
  if (!p) notFound();
  return <ProductDetail p={p} pricing={pricing} />;
}
