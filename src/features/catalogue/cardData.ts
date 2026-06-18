/** Server-precomputed, client-safe product card data (no prisma / pricing shipped to client). */
export interface CardData {
  slug: string;
  name: string;
  series: string;
  finishes: string[];
  status: string;
  featured: boolean;
  sizes: number;
  priceStr: string;
  minINR: number | null;
  img: string;
  imgHover?: string;
  soldOut: boolean;
}

import type { ProductView } from "@/services/catalogue/catalogue";
import { cardPrice, cardMinINR } from "@/services/catalogue/catalogue";
import type { PricingConfig } from "@/services/pricing/PricingService";

/** Build client-safe card data from full product views. Server-only callers. */
export function toCardData(products: ProductView[], pricing: PricingConfig): CardData[] {
  return products.map((p) => ({
    slug: p.slug,
    name: p.name,
    series: p.series,
    finishes: p.finishes,
    status: p.status,
    featured: p.featured,
    sizes: p.models.length,
    priceStr: cardPrice(p, pricing),
    minINR: cardMinINR(p, pricing),
    img: p.imgs[0],
    imgHover: p.imgs[1],
    soldOut: ["sold_out", "out"].includes(p.status?.toLowerCase()),
  }));
}
