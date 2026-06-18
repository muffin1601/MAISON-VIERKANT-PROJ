import type { Metadata } from "next";
import { getProducts, getActivePricing, cardPrice, cardMinINR } from "@/services/catalogue/catalogue";
import type { CardData } from "@/features/catalogue/CollectionBrowser";
import { WishlistView } from "@/features/catalogue/WishlistView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Your saved Maison Vierkant pieces.",
};

export default async function WishlistPage() {
  const [products, pricing] = await Promise.all([getProducts(), getActivePricing()]);
  const all: CardData[] = products.map((p) => ({
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

  return (
    <div className="page active">
      <div className="sw" style={{ paddingTop: 64 }}>
        <h1 className="ab-h" style={{ marginBottom: 24 }}>
          Wishlist
        </h1>
        <WishlistView all={all} />
      </div>
    </div>
  );
}
