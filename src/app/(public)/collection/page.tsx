import type { Metadata } from "next";
import { getProducts, getActivePricing, cardPrice, cardMinINR } from "@/services/catalogue/catalogue";
import { CollectionBrowser, type CardData } from "@/features/catalogue/CollectionBrowser";

export const metadata: Metadata = {
  title: "The Collection",
  description:
    "Browse the full range of handmade Atelier Vierkant clay vessels — planters, bowls, columns and seating — with India pricing.",
  alternates: { canonical: "/collection" },
};

export const dynamic = "force-dynamic";

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ series?: string }>;
}) {
  const { series } = await searchParams;
  const [products, pricing] = await Promise.all([getProducts(), getActivePricing()]);

  // Precompute client-safe card data (keeps prisma + pricing engine on the server).
  const items: CardData[] = products.map((p) => ({
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
    <div id="page-shop" className="page active">
      <div className="coll-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://wsrv.nl/?url=http%3A%2F%2Fvierkant.pixeo.be%2Fengine%2Fhandlers%2Fimage.asp%3Ft%3Dprojectslides%26i%3D723%26w%3D1680%26c%3Dfalse"
          alt=""
        />
        <div className="coll-hero-c">
          <div className="ey" style={{ color: "var(--gold2)" }}>
            Atelier Vierkant · Belgium · {products.length} Series ·{" "}
            {products.reduce((n, p) => n + p.models.length, 0)} Models
          </div>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(38px,5vw,68px)",
              fontWeight: 300,
              color: "white",
              lineHeight: 1.1,
            }}
          >
            The Complete <em style={{ color: "var(--gold2)" }}>Collection</em>
          </h1>
        </div>
      </div>
      <div className="sw" style={{ paddingTop: 44 }}>
        <CollectionBrowser items={items} initialSeries={series} />
      </div>
    </div>
  );
}
